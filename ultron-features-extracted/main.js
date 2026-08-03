const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let nextProcess = null;
let omniRouteProcess = null;
let fishTtsProcess = null;
const PORT = 7777;
const OMNIROUTE_PORT = 20128;
const FISH_TTS_PORT = 8765;

// Configure autoUpdater for background auto-updating
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function getAppDir() {
  // When packaged with asar:true (the default here), files live inside
  // resources/app.asar - Electron's patched fs module reads through it
  // transparently. Fall back to a plain 'app' folder in case asar is
  // ever turned off, then to __dirname for unpackaged/dev runs.
  if (!app.isPackaged) return __dirname;
  const asarDir = path.join(process.resourcesPath, 'app.asar');
  if (fs.existsSync(asarDir)) return asarDir;
  const plainDir = path.join(process.resourcesPath, 'app');
  if (fs.existsSync(plainDir)) return plainDir;
  return __dirname;
}

function hasProductionBuild(appDir) {
  return fs.existsSync(path.join(appDir, '.next', 'BUILD_ID'));
}

function runNextBuild(appDir, nextBin) {
  console.log('[U.L.T.R.O.N.] No production build found - building once before first launch...');
  return new Promise((resolve, reject) => {
    const buildProcess = spawn(process.execPath, [nextBin, 'build'], {
      cwd: appDir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    buildProcess.stdout.on('data', (d) => { out += d; console.log('[next build]', d.toString().trim()); });
    buildProcess.stderr.on('data', (d) => { out += d; console.error('[next build:err]', d.toString().trim()); });
    buildProcess.on('error', (err) => reject(new Error(`Failed to spawn next build: ${err.message}`)));
    buildProcess.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`next build exited with code ${code}.\n${out.slice(-2000)}`));
    });
  });
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

function getOmniRouteBin() {
  const appDir = getAppDir();
  const binPath = path.join(appDir, 'node_modules', 'omniroute', 'bin', 'omniroute');
  if (fs.existsSync(binPath)) return binPath;
  return null;
}

async function startOmniRoute() {
  // OmniRoute is the "Duo Mode" cloud multi-brain gateway (290+ providers,
  // 90+ free tiers) bundled as a plain node_modules dependency - no
  // separate download, it ships inside the installer like any other package.
  try {
    await waitForServer(`http://127.0.0.1:${OMNIROUTE_PORT}`, 1, 100);
    console.log('[U.L.T.R.O.N.] OmniRoute gateway already active.');
    return;
  } catch (_) {}

  const appDir = getAppDir();
  const bin = getOmniRouteBin();
  if (!bin) {
    console.warn('[U.L.T.R.O.N.] OmniRoute binary not found - the "omniroute" brain will be unavailable this session.');
    return;
  }

  omniRouteProcess = spawn(process.execPath, [bin], {
    cwd: appDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(OMNIROUTE_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  omniRouteProcess.stdout.on('data', (d) => console.log('[omniroute]', d.toString().trim()));
  omniRouteProcess.stderr.on('data', (d) => console.error('[omniroute:err]', d.toString().trim()));
  omniRouteProcess.on('error', (err) => console.error('[U.L.T.R.O.N.] Failed to spawn OmniRoute:', err.message));

  // Best-effort - don't block app startup if OmniRoute is slow to come up.
  // aiRouter's own connection attempt will simply fail over to the next brain
  // if it isn't ready yet by the time a chat request comes in.
  waitForServer(`http://127.0.0.1:${OMNIROUTE_PORT}`, 20, 500).catch(() => {
    console.warn('[U.L.T.R.O.N.] OmniRoute did not come up within 10s - continuing without it for now.');
  });
}


function getFishTtsPaths() {
  const appDir = getAppDir();
  const serviceDir = path.join(appDir, 'python-services', 'fish-tts');
  const venvPython = process.platform === 'win32'
    ? path.join(serviceDir, '.venv', 'Scripts', 'python.exe')
    : path.join(serviceDir, '.venv', 'bin', 'python');
  return { serviceDir, venvPython, serverScript: path.join(serviceDir, 'server.py') };
}

async function startFishTts() {
  // Optional feature: only the jarvis/friday/edith voice personas use this.
  // If the one-time Python setup (scripts/setup-local-ai.sh) hasn't been
  // run, skip quietly - voiceEngine.ts falls back to Web Speech API for
  // those personas rather than failing.
  const { serviceDir, venvPython, serverScript } = getFishTtsPaths();
  if (!fs.existsSync(venvPython) || !fs.existsSync(serverScript)) {
    console.log('[U.L.T.R.O.N.] Fish TTS not set up (run scripts/setup-local-ai.sh) - jarvis/friday/edith will use Web Speech API voices this session.');
    return;
  }

  try {
    await waitForServer(`http://127.0.0.1:${FISH_TTS_PORT}/health`, 1, 100);
    console.log('[U.L.T.R.O.N.] Fish TTS already active.');
    return;
  } catch (_) {}

  fishTtsProcess = spawn(venvPython, [serverScript], {
    cwd: serviceDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  fishTtsProcess.stdout.on('data', (d) => console.log('[fish-tts]', d.toString().trim()));
  fishTtsProcess.stderr.on('data', (d) => console.error('[fish-tts:err]', d.toString().trim()));
  fishTtsProcess.on('error', (err) => console.warn('[U.L.T.R.O.N.] Fish TTS failed to spawn:', err.message));

  waitForServer(`http://127.0.0.1:${FISH_TTS_PORT}/health`, 40, 500).catch(() => {
    console.warn('[U.L.T.R.O.N.] Fish TTS did not come up within 20s - it can take longer on first load while the model warms up.');
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

  if (!hasProductionBuild(appDir)) {
    await runNextBuild(appDir, nextBin);
  }

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
    startOmniRoute(); // fire-and-forget, non-blocking
    startFishTts();   // fire-and-forget, non-blocking - optional feature
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
  if (omniRouteProcess) {
    omniRouteProcess.kill();
    omniRouteProcess = null;
  }
  if (fishTtsProcess) {
    fishTtsProcess.kill();
    fishTtsProcess = null;
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
