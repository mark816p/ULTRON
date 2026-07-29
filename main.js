const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let nextProcess = null;
const PORT = 7777;

// Configure autoUpdater for background auto-updating
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function getAppDir() {
  // When packaged with asar:false, files are at resources/app/
  // When not packaged, they are at __dirname
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : __dirname;
}

function getNextBin() {
  const appDir = getAppDir();
  const nextPath = path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (fs.existsSync(nextPath)) {
    return nextPath;
  }
  return null;
}

function waitForServer(url, retries, delay) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      http
        .get(url, (res) => {
          if (res.statusCode < 500) {
            resolve();
          } else if (n > 0) {
            setTimeout(() => attempt(n - 1), delay);
          } else {
            reject(new Error(`Server at ${url} returned status ${res.statusCode}`));
          }
        })
        .on('error', () => {
          if (n > 0) {
            setTimeout(() => attempt(n - 1), delay);
          } else {
            reject(new Error(`Could not connect to server at ${url} after multiple retries`));
          }
        });
    }
    attempt(retries);
  });
}

async function startNextServer() {
  // If server already running, reuse it
  try {
    await waitForServer(`http://127.0.0.1:${PORT}`, 1, 100);
    console.log('[U.L.T.R.O.N.] Neural bridge already active.');
    return;
  } catch (_) {}

  const appDir = getAppDir();
  const nextBin = getNextBin();

  if (!nextBin) {
    throw new Error(
      `Could not locate Next.js script.\nappDir=${appDir}\nExpected at: ${path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next')}`
    );
  }

  console.log(
    `[U.L.T.R.O.N.] Spawning Neural Bridge using Node via Electron:\n  script=${nextBin}\n  cwd=${appDir}\n  port=${PORT}`
  );

  return new Promise((resolve, reject) => {
    nextProcess = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
      cwd: appDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        PORT: String(PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    nextProcess.stdout.on('data', (data) => {
      console.log('[next]', data.toString().trim());
    });

    nextProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      console.error('[next:err]', msg.trim());
    });

    nextProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn next process: ${err.message}`));
    });

    nextProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`next process exited with code ${code}.\n${stderr}`));
      }
    });

    // Poll up to 60 seconds (120 × 500ms) for the server to be ready
    waitForServer(`http://127.0.0.1:${PORT}`, 120, 500)
      .then(resolve)
      .catch(reject);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    title: 'U.L.T.R.O.N. Autonomous Neural Orb',
    icon: path.join(__dirname, 'public/favicon.ico'),
    backgroundColor: '#0c0c0c',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  try {
    await startNextServer();
    await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    mainWindow.show();
  } catch (e) {
    console.error('Failed to load U.L.T.R.O.N. UI:', e);
    const errMsg = encodeURIComponent(
      (e.stack || e.message || String(e)).slice(0, 3000)
    );
    const errHtml =
      `data:text/html;charset=utf-8,` +
      `<html><body style="background:%230c0c0c;color:%23e6e6e6;font-family:sans-serif;padding:50px;text-align:center;">` +
      `<h2 style="color:%23ffffff;">U.L.T.R.O.N. Neural Bridge Diagnostics</h2>` +
      `<p style="color:%23aaaaaa;">Server initialization on port ${PORT} encountered an issue.</p>` +
      `<pre style="background:%231a1a1a;padding:15px;border-radius:6px;display:inline-block;color:%23ff4444;` +
      `text-align:left;white-space:pre-wrap;word-break:break-all;max-width:85%;">${errMsg}</pre>` +
      `</body></html>`;
    await mainWindow.loadURL(errHtml);
    mainWindow.show();
  }

  // Check for background updates silently
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.log('Auto-updater offline or unreachable:', e.message);
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
