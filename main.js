const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let nextProcess;
const PORT = 7777; // Dedicated app port (avoids localhost:3000 collision)

function startNextJs() {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}`, () => {
      resolve();
    }).on('error', () => {
      const nextCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      nextProcess = spawn(nextCmd, ['next', 'start', '-p', String(PORT)], {
        cwd: __dirname,
        env: { ...process.env, PORT: String(PORT) },
        stdio: 'inherit'
      });

      const checkInterval = setInterval(() => {
        http.get(`http://127.0.0.1:${PORT}`, () => {
          clearInterval(checkInterval);
          resolve();
        }).on('error', () => {});
      }, 500);
    });
  });
}

async function createWindow() {
  await startNextJs();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    title: "U.L.T.R.O.N. Autonomous Neural Orb",
    icon: path.join(__dirname, 'public/favicon.ico'),
    backgroundColor: '#0c0c0c',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
