import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';

export class DependencyManager {
  private static ollamaProcess: ChildProcess | null = null;
  private static lmStudioProcess: ChildProcess | null = null;
  private static isDownloadingOllama = false;
  private static isGraphifyRunning = false;
  private static isGraphifyInstalled = false;

  private static getBinDir(): string {
    const binDir = path.join(os.homedir(), 'AppData', 'Local', 'ULTRON', 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }
    return binDir;
  }

  /**
   * Downloads a file from a URL to a local destination
   */
  private static downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const request = (url.startsWith('https') ? https : http).get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return this.downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }

  /**
   * Checks if a server is running at the given URL
   */
  private static async isServerRunning(urlStr: string): Promise<boolean> {
    return new Promise((resolve) => {
      const parsedUrl = new URL(urlStr);
      const req = http.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: '/',
        method: 'GET',
        timeout: 1000
      }, (res) => {
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  /**
   * Ensures Ollama is installed and running
   */
  public static async ensureOllama(): Promise<void> {
    const isRunning = await this.isServerRunning('http://127.0.0.1:11434');
    if (isRunning) return;

    if (this.ollamaProcess) return; // Already started by us
    if (this.isDownloadingOllama) {
      // Wait for download to finish
      while (this.isDownloadingOllama) {
        await new Promise(r => setTimeout(r, 1000));
      }
      if (await this.isServerRunning('http://127.0.0.1:11434')) return;
    }

    const binDir = this.getBinDir();
    const ollamaZipPath = path.join(binDir, 'ollama-windows-amd64.zip');
    const ollamaExePath = path.join(binDir, 'ollama.exe');

    // If it doesn't exist, we must download the zip and extract it
    if (!fs.existsSync(ollamaExePath)) {
      this.isDownloadingOllama = true;
      try {
        console.log('[DependencyManager] Downloading Ollama standalone executable...');
        // Download official windows zip
        await this.downloadFile('https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip', ollamaZipPath);
        
        // Extract the zip using PowerShell
        console.log('[DependencyManager] Extracting Ollama...');
        await new Promise<void>((resolve, reject) => {
          const p = spawn('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path "${ollamaZipPath}" -DestinationPath "${binDir}" -Force`]);
          p.on('close', (code) => {
            if (code === 0) resolve(); else reject(new Error('Failed to extract Ollama'));
          });
        });
        
        fs.unlinkSync(ollamaZipPath);
      } catch (err) {
        console.error('[DependencyManager] Failed to install Ollama:', err);
      } finally {
        this.isDownloadingOllama = false;
      }
    }

    if (fs.existsSync(ollamaExePath)) {
      console.log('[DependencyManager] Starting local Ollama server...');
      this.ollamaProcess = spawn(ollamaExePath, ['serve'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      this.ollamaProcess.unref();

      // Wait a moment for server to bind
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await this.isServerRunning('http://127.0.0.1:11434')) break;
      }
    }
  }

  /**
   * Ensures LM Studio is running via the `lms` CLI
   */
  public static async ensureLMStudio(): Promise<void> {
    const isRunning = await this.isServerRunning('http://127.0.0.1:1234');
    if (isRunning) return;

    if (this.lmStudioProcess) return;

    console.log('[DependencyManager] Starting LM Studio local server via lms cli...');
    
    // We assume `lms` is installed and in the user's PATH (part of LM Studio).
    // The lms cli can start the server in the background using `lms server start`
    // We will spawn it and hope it starts the server.
    try {
      this.lmStudioProcess = spawn('npx', ['lms', 'server', 'start'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: true
      });
      this.lmStudioProcess.unref();

      // Wait a moment for server to bind
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await this.isServerRunning('http://127.0.0.1:1234')) break;
      }
    } catch (err) {
      console.warn("[DependencyManager] Failed to start LM studio: ", err);
    }
  }

  /**
   * Kills all managed daemon processes
   */
  public static killDaemons(): void {
    if (this.ollamaProcess) {
      try { process.kill(-this.ollamaProcess.pid!); } catch (e) {}
      try { this.ollamaProcess.kill('SIGINT'); } catch (e) {}
    }
    if (this.lmStudioProcess) {
      try { process.kill(-this.lmStudioProcess.pid!); } catch (e) {}
      try { this.lmStudioProcess.kill('SIGINT'); } catch (e) {}
    }
  }

  /**
   * Installs Graphify via uv and ensures it is available
   */
  public static async ensureGraphify(): Promise<boolean> {
    if (this.isGraphifyInstalled) return true;

    console.log("Checking if Graphify is installed...");
    return new Promise((resolve) => {
      // Check if graphify is installed
      const checkProcess = spawn(
        process.platform === "win32" ? "cmd" : "sh",
        process.platform === "win32" ? ["/c", "graphify --help"] : ["-c", "graphify --help"],
        { shell: true }
      );
      
      checkProcess.on("close", (code) => {
        if (code === 0) {
          console.log("Graphify is already installed.");
          this.isGraphifyInstalled = true;
          resolve(true);
        } else {
          console.log("Graphify not found. Installing via uv tool...");
          // Need to install via uv
          const installProcess = spawn(
            process.platform === "win32" ? "cmd" : "sh",
            process.platform === "win32" ? ["/c", "uv tool install graphifyy"] : ["-c", "uv tool install graphifyy"],
            { shell: true, stdio: "inherit" }
          );
          
          installProcess.on("close", (installCode) => {
            if (installCode === 0) {
              console.log("Graphify installed successfully.");
              this.isGraphifyInstalled = true;
              resolve(true);
            } else {
              console.error("Failed to install Graphify. Ensure 'uv' and python are installed on the system.");
              resolve(false);
            }
          });
        }
      });
    });
  }
}

if (typeof process !== 'undefined') {
  process.on('exit', () => DependencyManager.killDaemons());
  process.on('SIGINT', () => { DependencyManager.killDaemons(); process.exit(); });
  process.on('SIGTERM', () => { DependencyManager.killDaemons(); process.exit(); });
}
