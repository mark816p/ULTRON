const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { autoUpdater } = require('electron-updater');

let mainWindow;
const PORT = 7777;

// Configure autoUpdater for background auto-updating
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

async function startNextServer() {
  return new Promise((resolve, reject) => {
    // Check if server is already active on port 7777
    http.get(`http://127.0.0.1:${PORT}`, () => {
      resolve();
    }).on('error', async () => {
      try {
        const next = require('next');
        const dev = false;
        const nextApp = next({ dev, dir: __dirname });
        await nextApp.prepare();
        const handle = nextApp.getRequestHandler();

        const server = http.createServer((req, res) => {
          handle(req, res);
        });

        server.listen(PORT, '127.0.0.1', () => {
          console.log(`[U.L.T.R.O.N.] Internal Neural Bridge active on http://127.0.0.1:${PORT}`);
          resolve();
        });

        server.on('error', (err) => {
          console.error('[U.L.T.R.O.N.] Server listen error:', err);
          reject(err);
        });
      } catch (err) {
        console.error('[U.L.T.R.O.N.] Failed to initialize Next.js engine:', err);
        reject(err);
      }
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    title: "U.L.T.R.O.N. Autonomous Neural Orb",
    icon: path.join(__dirname, 'public/favicon.ico'),
    backgroundColor: '#0c0c0c',
    autoHideMenuBar: true,
    show: false, // Show once loaded to prevent white flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
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
    console.error("Failed to load U.L.T.R.O.N. UI:", e);
    // If server fails for any reason, display emergency diagnostic HUD instead of failing silently
    const errHtml = `data:text/html;charset=utf-8,<html><body style="background:#0c0c0c;color:#e6e6e6;font-family:sans-serif;padding:50px;text-align:center;"><h2 style="color:#ffffff;">U.L.T.R.O.N. Neural Bridge Diagnostics</h2><p style="color:#aaaaaa;">Server initialization on port ${PORT} encountered an issue.</p><p style="background:#1a1a1a;padding:15px;border-radius:6px;display:inline-block;color:#ff4444;">${e.message || e}</p></body></html>`;
    await mainWindow.loadURL(errHtml);
    mainWindow.show();
  }

  // Check for background updates silently
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.log("Auto-updater offline or unreachable:", e.message);
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
