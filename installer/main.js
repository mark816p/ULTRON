const { app, BrowserWindow, ipcMain, shell } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 560,
    height: 620,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'icon.ico'),
    title: 'U.L.T.R.O.N. Installer',
  });

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

function remapLegacyTag(tag) {
  if (!tag || tag === 'latest') return 'v9.4.5';
  const clean = String(tag).replace(/^v/, '');
  const parts = clean.split('.').map(Number);
  const major = parts[0] || 0;
  const patch = parts[2] || 0;
  if (major === 9 && parts[1] === 4) return tag.startsWith('v') ? tag : `v${tag}`;
  if (major >= 51 && patch >= 3) return 'v9.4.5';
  if (major >= 51 && patch === 2) return 'v9.4.5';
  if (major >= 51 && patch === 1) return 'v9.4.4';
  if (major >= 51 && patch === 0) return 'v9.4.3';
  if (major >= 49) return 'v9.4.2';
  if (major >= 45) return 'v9.4.1';
  if (major >= 44) return 'v9.4.0';
  if (major >= 42) return 'v9.3.0';
  if (major >= 39) return 'v9.2.0';
  return 'v9.1.0';
}

function getDefaultVersionList() {
  return [
    { tag: 'v9.4.5', name: 'v9.4.5 — Latest Unified Release', rawTag: 'latest' },
    { tag: 'v9.4.5', name: 'v9.4.5 — Advanced Hologram Stage', rawTag: 'v51.5.2' },
    { tag: 'v9.4.4', name: 'v9.4.4 — Accomplish AI Coworker', rawTag: 'v51.5.1' },
    { tag: 'v9.4.3', name: 'v9.4.3 — OpenJarvis Desktop Control', rawTag: 'v51.5.0' },
    { tag: 'v9.4.2', name: 'v9.4.2 — Fish Studio Voices', rawTag: 'v49.0.0' },
    { tag: 'v9.4.1', name: 'v9.4.1 — MediaPipe & VAD Engine', rawTag: 'v45.0.0' },
    { tag: 'v9.4.0', name: 'v9.4.0 — Core OS Launch', rawTag: 'v44.0.0' },
  ];
}

// ── IPC: fetch releases from GitHub API ──────────────────────────────────────
ipcMain.handle('get-releases', async () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/mark816p/ULTRON/releases',
      method: 'GET',
      headers: { 'User-Agent': 'ULTRON-Installer/9.4.5' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const releases = JSON.parse(data);
          if (Array.isArray(releases) && releases.length > 0) {
            const seen = new Set();
            const mapped = [];
            
            // Force v9.4.5 at top
            mapped.push({ tag: 'v9.4.5', name: 'v9.4.5 — Latest Unified Release', rawTag: 'latest' });
            seen.add('v9.4.5');

            for (const r of releases) {
              const mappedTag = remapLegacyTag(r.tag_name);
              if (!seen.has(mappedTag)) {
                seen.add(mappedTag);
                mapped.push({ tag: mappedTag, name: `${mappedTag} — Release`, rawTag: r.tag_name });
              }
            }
            resolve(mapped);
          } else {
            resolve(getDefaultVersionList());
          }
        } catch {
          resolve(getDefaultVersionList());
        }
      });
    });
    req.on('error', () => resolve(getDefaultVersionList()));
    req.end();
  });
});

// ── IPC: download + launch ───────────────────────────────────────────────────
ipcMain.handle('download-and-install', async (event, tag) => {
  const platform = os.platform();
  let assetName, ext;
  if (platform === 'win32') { assetName = 'ULTRON-Setup.exe'; ext = '.exe'; }
  else if (platform === 'darwin') { assetName = 'ULTRON-Setup.dmg'; ext = '.dmg'; }
  else { assetName = 'ULTRON-Setup.AppImage'; ext = '.AppImage'; }

  let url;
  if (tag === 'latest') {
    url = `https://github.com/mark816p/ULTRON/releases/latest/download/${assetName}`;
  } else {
    url = `https://github.com/mark816p/ULTRON/releases/download/${tag}/${assetName}`;
  }

  const dest = path.join(os.tmpdir(), `ULTRON-Setup-${tag}${ext}`);

  return new Promise((resolve, reject) => {
    const follow = (redirectUrl, depth = 0) => {
      if (depth > 10) return reject(new Error('Too many redirects'));
      const mod = redirectUrl.startsWith('https') ? https : http;
      mod.get(redirectUrl, { headers: { 'User-Agent': 'ULTRON-Installer/9.4.5' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const file = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          received += chunk.length;
          file.write(chunk);
          if (total > 0) {
            win.webContents.send('download-progress', Math.round((received / total) * 100));
          }
        });
        res.on('end', () => {
          file.end();
          // Launch installer
          if (platform === 'win32') {
            exec(`"${dest}"`, (err) => { if (err) reject(err); else resolve(); });
          } else if (platform === 'darwin') {
            exec(`hdiutil attach "${dest}"`, (err) => { if (err) reject(err); else resolve(); });
          } else {
            fs.chmodSync(dest, '755');
            exec(`"${dest}"`, (err) => { if (err) reject(err); else resolve(); });
          }
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
});

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('close-app', () => app.quit());
ipcMain.on('open-github', () => shell.openExternal('https://github.com/mark816p/ULTRON/releases'));
