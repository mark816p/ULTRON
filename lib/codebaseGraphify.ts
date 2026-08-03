import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DependencyManager } from './dependencyManager';
import { MemoryGraphEngine } from './memoryGraph';

export class CodebaseGraphify {
  private static instance: CodebaseGraphify;

  private constructor() {}

  public static getInstance(): CodebaseGraphify {
    if (!CodebaseGraphify.instance) {
      CodebaseGraphify.instance = new CodebaseGraphify();
    }
    return CodebaseGraphify.instance;
  }

  /**
   * Run Graphify to extract the AST of the current project directory.
   */
  public async extractCodebase(targetPath: string = process.cwd()): Promise<boolean> {
    const isReady = await DependencyManager.ensureGraphify();
    if (!isReady) {
      throw new Error("Graphify is not installed or could not be installed.");
    }

    console.log(`[CodebaseGraphify] Running extraction on ${targetPath}...`);
    return new Promise((resolve, reject) => {
      const graphifyProcess = spawn(
        process.platform === "win32" ? "cmd" : "sh",
        process.platform === "win32"
          ? ["/c", `graphify extract --code-only --no-cluster`]
          : ["-c", `graphify extract --code-only --no-cluster`],
        { shell: true, cwd: targetPath }
      );

      let stderrData = '';
      graphifyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      graphifyProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`[CodebaseGraphify] Extraction complete for ${targetPath}.`);
          resolve(true);
        } else {
          console.error(`[CodebaseGraphify] Extraction failed with code ${code}. Error: ${stderrData}`);
          reject(new Error(`Graphify extraction failed: ${stderrData}`));
        }
      });
    });
  }

  /**
   * Reads graphify-out/graph.json and injects the AST nodes into ULTRON's memory.
   */
  public async injectGraphIntoMemory(targetPath: string = process.cwd()): Promise<number> {
    const graphJsonPath = path.join(targetPath, 'graphify-out', 'graph.json');
    if (!fs.existsSync(graphJsonPath)) {
      throw new Error(`Graph JSON not found at ${graphJsonPath}. Run extractCodebase first.`);
    }

    const rawData = fs.readFileSync(graphJsonPath, 'utf-8');
    let graphData: any;
    try {
      graphData = JSON.parse(rawData);
    } catch (e) {
      throw new Error(`Failed to parse graph.json: ${(e as Error).message}`);
    }

    const engine = MemoryGraphEngine.getInstance();
    let importedNodes = 0;

    const nodes = graphData.nodes || [];

    for (const node of nodes) {
      const label = node.label || node.id || "Unknown";
      const content = JSON.stringify(node.properties || node.metadata || {}, null, 2);
      engine.addNode(
        `[Graphify AST] ${node.type || 'code_symbol'} - ${label}\n\n${content}`,
        'code',
        ['graphify', 'ast', node.type || 'code_symbol']
      );
      importedNodes++;
    }

    console.log(`[CodebaseGraphify] Injected ${importedNodes} nodes into ULTRON memory.`);
    return importedNodes;
  }
}
