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

// ── IPC: fetch releases from GitHub API ──────────────────────────────────────
ipcMain.handle('get-releases', async () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/mark816p/ULTRON/releases',
      method: 'GET',
      headers: { 'User-Agent': 'ULTRON-Installer/43.0.0' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const releases = JSON.parse(data);
          if (Array.isArray(releases) && releases.length > 0) {
            resolve(releases.map((r) => ({ tag: r.tag_name, name: r.name || r.tag_name })));
          } else {
            resolve([{ tag: 'latest', name: 'Latest (Auto-Detect)' }]);
          }
        } catch {
          resolve([{ tag: 'latest', name: 'Latest (Auto-Detect)' }]);
        }
      });
    });
    req.on('error', () => resolve([{ tag: 'latest', name: 'Latest (Auto-Detect)' }]));
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
      mod.get(redirectUrl, { headers: { 'User-Agent': 'ULTRON-Installer/43.0.0' } }, (res) => {
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
