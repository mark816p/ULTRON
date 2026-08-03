import * as fs from "fs";
import * as path from "path";

export class SelfModifier {
  private static instance: SelfModifier;
  
  // Try to find the root based on .next directory or default to cwd
  private projectRoot: string;
  private dataDir: string;
  private editLogPath: string;

  private constructor() {
    this.projectRoot = this.findProjectRoot();
    this.dataDir = path.join(this.projectRoot, "data");
    this.editLogPath = path.join(this.dataDir, "self_edit_log.json");
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.editLogPath)) {
      fs.writeFileSync(this.editLogPath, JSON.stringify([]));
    }
  }

  public static getInstance(): SelfModifier {
    if (!SelfModifier.instance) {
      SelfModifier.instance = new SelfModifier();
    }
    return SelfModifier.instance;
  }

  private findProjectRoot(): string {
    let current = process.cwd();
    // Simple heuristic: walk up until we find package.json or give up
    let attempts = 0;
    while (attempts < 5) {
      if (fs.existsSync(path.join(current, ".next")) || fs.existsSync(path.join(current, "package.json"))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
      attempts++;
    }
    return process.cwd();
  }

  private isSafePath(absolutePath: string): boolean {
    // Basic path traversal and dangerous target protections
    const rel = path.relative(this.projectRoot, absolutePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
    if (rel.includes("node_modules") || rel.includes(".git")) return false;
    return true;
  }

  private logEdit(action: string, filePath: string, originalContent?: string, newContent?: string) {
    try {
      const logs = JSON.parse(fs.readFileSync(this.editLogPath, "utf-8"));
      logs.push({
        timestamp: new Date().toISOString(),
        action,
        filePath,
        originalContent: originalContent ? Buffer.from(originalContent).toString("base64") : null,
        newContent: newContent ? Buffer.from(newContent).toString("base64") : null
      });
      fs.writeFileSync(this.editLogPath, JSON.stringify(logs, null, 2));
    } catch (e) {
      console.error("Failed to log edit", e);
    }
  }

  public readProjectFile(relativePath: string): string {
    const fullPath = path.join(this.projectRoot, relativePath);
    if (!this.isSafePath(fullPath)) throw new Error("Unsafe path accessed");
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.size > 5 * 1024 * 1024) throw new Error("File too large (Max 5MB)");
    
    return fs.readFileSync(fullPath, "utf-8");
  }

  public writeProjectFile(relativePath: string, content: string): void {
    const fullPath = path.join(this.projectRoot, relativePath);
    if (!this.isSafePath(fullPath)) throw new Error("Unsafe path accessed");

    let originalContent: string | undefined;
    if (fs.existsSync(fullPath)) {
      originalContent = fs.readFileSync(fullPath, "utf-8");
      // Create backup before writing
      this.createBackup(relativePath);
    } else {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    this.logEdit("WRITE", relativePath, originalContent, content);
  }

  public listProjectFiles(directory: string = ""): string[] {
    const fullPath = path.join(this.projectRoot, directory);
    if (!this.isSafePath(fullPath)) throw new Error("Unsafe path accessed");
    if (!fs.existsSync(fullPath)) return [];

    let results: string[] = [];
    const items = fs.readdirSync(fullPath);

    for (const item of items) {
      if (item === "node_modules" || item === ".git") continue;
      const itemPath = path.join(fullPath, item);
      const stat = fs.statSync(itemPath);
      const relPath = path.relative(this.projectRoot, itemPath);
      
      if (stat.isDirectory()) {
        results = results.concat(this.listProjectFiles(relPath));
      } else {
        results.push(relPath);
      }
    }
    return results;
  }

  public getProjectStructure(): any {
    const walk = (dir: string): any => {
      const result: any = { name: path.basename(dir), type: "directory", children: [] };
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item === "node_modules" || item === ".git") continue;
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          result.children.push(walk(itemPath));
        } else {
          result.children.push({ name: item, type: "file", size: stat.size });
        }
      }
      return result;
    };
    
    return walk(this.projectRoot);
  }

  public searchInCode(query: string): { file: string; line: number; text: string }[] {
    const files = this.listProjectFiles();
    const results: { file: string; line: number; text: string }[] = [];
    
    for (const file of files) {
      // Skip large or non-text files
      if (file.endsWith(".json") && file.includes("data/")) continue;
      if (file.match(/\.(jpg|png|gif|ico|pdf|zip|mp4)$/i)) continue;
      
      try {
        const content = this.readProjectFile(file);
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(query)) {
            results.push({ file, line: i + 1, text: lines[i].trim() });
          }
        }
      } catch (e) {
        // Skip errors on read
      }
    }
    return results;
  }

  public applyPatch(relativePath: string, originalText: string, newText: string): boolean {
    try {
      const content = this.readProjectFile(relativePath);
      if (!content.includes(originalText)) {
        return false;
      }
      const updated = content.replace(originalText, newText);
      this.writeProjectFile(relativePath, updated);
      return true;
    } catch (e) {
      return false;
    }
  }

  public createNewComponent(name: string, code: string): void {
    // Assumes standard React project structure where components are in src/components or components/
    const componentsDir = fs.existsSync(path.join(this.projectRoot, "src", "components")) 
      ? path.join("src", "components") 
      : "components";
      
    this.writeProjectFile(path.join(componentsDir, `${name}.tsx`), code);
  }

  public createNewApiRoute(route: string, code: string): void {
    // Assumes App router (app/api/...) or Pages router (pages/api/...)
    let apiDir = "app/api";
    if (fs.existsSync(path.join(this.projectRoot, "pages", "api"))) {
      apiDir = "pages/api";
    }
    
    // Convert e.g., 'users' to 'users/route.ts' for App router, or 'users.ts' for Pages router
    let filePath = "";
    if (apiDir === "app/api") {
      filePath = path.join(apiDir, route, "route.ts");
    } else {
      filePath = path.join(apiDir, `${route}.ts`);
    }
    
    this.writeProjectFile(filePath, code);
  }

  public updateConfig(key: string, value: any): void {
    try {
      const pkgPath = "package.json";
      const pkg = JSON.parse(this.readProjectFile(pkgPath));
      
      // Simple path setting, e.g. "dependencies.lodash"
      const parts = key.split(".");
      let current = pkg;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      
      this.writeProjectFile(pkgPath, JSON.stringify(pkg, null, 2));
    } catch (e) {
      throw new Error(`Failed to update config: ${e}`);
    }
  }

  public createBackup(relativePath?: string): string {
    const backupDir = path.join(this.dataDir, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    
    if (relativePath) {
      const content = this.readProjectFile(relativePath);
      const backupPath = path.join(backupDir, `${path.basename(relativePath)}.${timestamp}.bak`);
      fs.writeFileSync(backupPath, content, "utf-8");
      return backupPath;
    } else {
      // Backup essential config files
      const files = ["package.json", "tsconfig.json", "next.config.js"];
      for (const f of files) {
        if (fs.existsSync(path.join(this.projectRoot, f))) {
          fs.copyFileSync(
            path.join(this.projectRoot, f), 
            path.join(backupDir, `${f}.${timestamp}.bak`)
          );
        }
      }
      return backupDir;
    }
  }

  public getEditHistory(): any[] {
    try {
      return JSON.parse(fs.readFileSync(this.editLogPath, "utf-8"));
    } catch (e) {
      return [];
    }
  }

  public revertLastEdit(): boolean {
    const logs = this.getEditHistory();
    if (logs.length === 0) return false;
    
    const lastEdit = logs[logs.length - 1];
    if (lastEdit.action !== "WRITE") return false;
    
    if (lastEdit.originalContent === null) {
      // File was created, so we delete it
      const fullPath = path.join(this.projectRoot, lastEdit.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } else {
      // Restore original content
      const content = Buffer.from(lastEdit.originalContent, "base64").toString("utf-8");
      fs.writeFileSync(path.join(this.projectRoot, lastEdit.filePath), content, "utf-8");
    }
    
    // Remove the log entry
    logs.pop();
    fs.writeFileSync(this.editLogPath, JSON.stringify(logs, null, 2));
    return true;
  }

  public validateTypeScript(code: string): { valid: boolean; errors: string[] } {
    // Simplistic heuristic validation for obvious syntax errors
    const errors: string[] = [];
    
    // Check for unbalanced braces, brackets, parens
    let braces = 0, brackets = 0, parens = 0;
    for (const char of code) {
      if (char === "{") braces++;
      if (char === "}") braces--;
      if (char === "[") brackets++;
      if (char === "]") brackets--;
      if (char === "(") parens++;
      if (char === ")") parens--;
    }
    
    if (braces !== 0) errors.push(`Unbalanced curly braces: ${braces > 0 ? '+' : ''}${braces}`);
    if (brackets !== 0) errors.push(`Unbalanced square brackets: ${brackets > 0 ? '+' : ''}${brackets}`);
    if (parens !== 0) errors.push(`Unbalanced parentheses: ${parens > 0 ? '+' : ''}${parens}`);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const selfModifier = SelfModifier.getInstance();
