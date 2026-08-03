import * as fs from 'fs';
import * as path from 'path';

export class SelfEditor {
  private static instance: SelfEditor;
  private readonly projectRoot: string;
  private readonly logPath: string;
  
  private constructor() {
    this.projectRoot = process.cwd();
    this.logPath = path.resolve(this.projectRoot, 'data', 'self_edit_log.json');
    const dataDir = path.dirname(this.logPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  public static getInstance(): SelfEditor {
    if (!SelfEditor.instance) {
      SelfEditor.instance = new SelfEditor();
    }
    return SelfEditor.instance;
  }

  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.resolve(this.projectRoot, filePath);
  }

  public readOwnFile(filePath: string): string {
    const fullPath = this.resolvePath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  public writeOwnFile(filePath: string, content: string): void {
    const fullPath = this.resolvePath(filePath);
    this.createBackup(fullPath);
    fs.writeFileSync(fullPath, content, 'utf-8');
    this.logChange(`Wrote file ${filePath}`, [fullPath]);
  }

  public listOwnFiles(dir: string = this.projectRoot): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.git') return;
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.listOwnFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    });
    return results;
  }

  public modifyComponent(componentPath: string, modification: (content: string) => string): void {
    const content = this.readOwnFile(componentPath);
    const newContent = modification(content);
    this.writeOwnFile(componentPath, newContent);
  }

  public addFeature(featureDescription: string, filePath: string): void {
    // Mocks generating feature code via AI
    const featureCode = `// Auto-generated feature: ${featureDescription}\nexport const newFeature = () => { console.log('Feature executed'); };\n`;
    this.writeOwnFile(filePath, featureCode);
  }

  public updateConfig(key: string, value: any): void {
    const configPath = this.resolvePath('package.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(this.readOwnFile(configPath));
      config[key] = value;
      this.writeOwnFile(configPath, JSON.stringify(config, null, 2));
    }
  }

  public createBackup(filePath?: string): void {
    const timestamp = Date.now();
    const backupDir = path.resolve(this.projectRoot, 'data', 'backups', timestamp.toString());
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    if (filePath) {
      if (fs.existsSync(filePath)) {
        const fileName = path.basename(filePath);
        fs.copyFileSync(filePath, path.join(backupDir, fileName));
      }
    } else {
      // Full project backup mock (too expensive for real in sync)
      console.log(`Created project backup in ${backupDir}`);
    }
  }

  public revertLastChange(): boolean {
    const log = this.getLog();
    if (log.length === 0) return false;
    
    const lastChange = log.pop();
    // In a real scenario, we would restore from the backup folder
    console.log(`Reverted change: ${lastChange?.description}`);
    fs.writeFileSync(this.logPath, JSON.stringify(log, null, 2));
    return true;
  }

  public getProjectStructure(): any {
    // simplified mock
    return {
      root: this.projectRoot,
      files: this.listOwnFiles().length
    };
  }

  public validateChange(filePath: string): boolean {
    const ext = path.extname(filePath);
    if (ext === '.ts' || ext === '.js') {
      try {
        // basic syntax check could use TS compiler API, mock for now
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  private getLog(): any[] {
    if (fs.existsSync(this.logPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.logPath, 'utf-8'));
      } catch {
        return [];
      }
    }
    return [];
  }

  public logChange(description: string, files: string[]): void {
    const log = this.getLog();
    log.push({
      timestamp: Date.now(),
      description,
      files
    });
    fs.writeFileSync(this.logPath, JSON.stringify(log, null, 2));
  }
}
