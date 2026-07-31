const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let nextProcess = null;
const PORT = 7777;

// Configure autoUpdater for background auto-updating
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function getAppDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : __dirname;
}

function getNextBin() {
  const appDir = getAppDir();
  const nextPath = path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  return fs.existsSync(nextPath) ? nextPath : null;
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
            reject(new Error(`Server returned status ${res.statusCode}`));
          }
        })
        .on('error', () => {
          if (n > 0) {
            setTimeout(() => attempt(n - 1), delay);
          } else {
            reject(new Error(`Could not connect to server after ${retries} retries`));
          }
        });
    }
    attempt(retries);
  });
}

// Write error HTML to a temp file and return its file:// URL
// This avoids data: URL blocking in Electron with contextIsolation
function writeErrorPage(errorText) {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>U.L.T.R.O.N. Diagnostics</title></head>
<body style="background:#0c0c0c;color:#e6e6e6;font-family:sans-serif;padding:50px;text-align:center;margin:0;">
  <h2 style="color:#ffffff;margin-bottom:12px;">U.L.T.R.O.N. Neural Bridge Diagnostics</h2>
  <p style="color:#aaaaaa;margin-bottom:20px;">Server initialization on port ${PORT} encountered an issue.</p>
  <pre style="background:#1a1a1a;padding:15px;border-radius:6px;display:inline-block;color:#ff4444;
    text-align:left;white-space:pre-wrap;word-break:break-all;max-width:85%;font-size:12px;">${errorText.slice(0, 4000)}</pre>
  <p style="color:#888;margin-top:20px;font-size:13px;">Close and reopen the app to retry.</p>
</body>
</html>`;
  const tmpFile = path.join(os.tmpdir(), 'ultron-error.html');
  fs.writeFileSync(tmpFile, html, 'utf8');
  return `file://${tmpFile.replace(/\\/g, '/')}`;
}

// Write loading screen to a temp file
function writeLoadingPage() {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>U.L.T.R.O.N. Loading</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#000; color:#00f0ff; font-family:"Courier New",monospace;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    height:100vh; overflow:hidden; }
  .ring { width:80px; height:80px; border:3px solid transparent;
    border-top-color:#00f0ff; border-radius:50%;
    animation:spin 1s linear infinite; margin-bottom:28px; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .title { font-size:22px; letter-spacing:4px; color:#00f0ff; margin-bottom:10px; }
  .sub { font-size:12px; color:#448; letter-spacing:2px; }
</style>
</head>
<body>
  <div class="ring"></div>
  <div class="title">U.L.T.R.O.N.</div>
  <div class="sub">INITIALIZING NEURAL BRIDGE...</div>
</body>
</html>`;
  const tmpFile = path.join(os.tmpdir(), 'ultron-loading.html');
  fs.writeFileSync(tmpFile, html, 'utf8');
  return `file://${tmpFile.replace(/\\/g, '/')}`;
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
      `Could not locate Next.js binary.\nappDir=${appDir}\nExpected: ${path.join(appDir, 'node_modules', 'next', 'dist', 'bin', 'next')}`
    );
  }

  console.log(`[U.L.T.R.O.N.] Spawning Neural Bridge\n  script=${nextBin}\n  cwd=${appDir}\n  port=${PORT}`);

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
    let rejected = false;

    const doReject = (err) => {
      if (!rejected) {
        rejected = true;
        reject(err);
      }
    };

    nextProcess.stdout.on('data', (data) => {
      console.log('[next]', data.toString().trim());
    });

    nextProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      console.error('[next:err]', msg.trim());
    });

    nextProcess.on('error', (err) => {
      doReject(new Error(`Failed to spawn Next.js: ${err.message}`));
    });

    nextProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        doReject(new Error(`Next.js exited with code ${code}.\n${stderr}`));
      }
    });

    // Poll up to 90 seconds for the server to be ready
    waitForServer(`http://127.0.0.1:${PORT}`, 180, 500)
      .then(resolve)
      .catch((err) => doReject(err));
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    title: 'U.L.T.R.O.N. Autonomous Neural Orb',
    icon: path.join(__dirname, 'public/favicon.ico'),
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: true, // Show immediately with loading page
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

  // Intercept any navigation failure (ERR_CONNECTION_REFUSED etc.)
  // and replace with our own error page instead of Chrome's native error
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // Ignore failures on our own file:// pages and about:blank
    if (validatedURL && (validatedURL.startsWith('file://') || validatedURL === 'about:blank')) return;
    console.error(`[U.L.T.R.O.N.] Page failed to load: ${errorDescription} (${errorCode}) at ${validatedURL}`);
    const errUrl = writeErrorPage(`Navigation failed: ${errorDescription} (code ${errorCode})\nURL: ${validatedURL}`);
    mainWindow.loadURL(errUrl).catch(console.error);
  });

  // Show loading screen immediately
  try {
    await mainWindow.loadURL(writeLoadingPage());
  } catch (e) {
    console.error('Could not load loading page:', e);
  }

  // Start the Next.js server in background
  try {
    await startNextServer();
    await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  } catch (e) {
    console.error('[U.L.T.R.O.N.] Failed to start server:', e);
    const errText = (e.stack || e.message || String(e));
    try {
      await mainWindow.loadURL(writeErrorPage(errText));
    } catch (e2) {
      console.error('Could not load error page:', e2);
    }
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
