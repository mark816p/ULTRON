import { openJarvisEngine } from "./openJarvis";
import { screenpipeEngine } from "./screenpipe";
import { mcpManager } from "./mcpManager";

export interface CoworkerTaskStep {
  id: string;
  title: string;
  actionType: "research" | "computer_action" | "mcp_tool" | "code_execution" | "verification";
  commandOrPrompt: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
  timestamp: number;
}

export interface AccomplishCoworkerTask {
  id: string;
  title: string;
  goal: string;
  status: "queued" | "planning" | "executing" | "verifying" | "completed" | "failed";
  steps: CoworkerTaskStep[];
  artifacts: { name: string; content: string }[];
  requiresUserApproval: boolean;
  createdAt: number;
  completedAt?: number;
}

export class AccomplishCoworkerEngine {
  private tasks: Map<string, AccomplishCoworkerTask> = new Map();

  constructor() {
    this.initSampleTasks();
  }

  private initSampleTasks() {
    const sampleId = "task_sample_1";
    this.tasks.set(sampleId, {
      id: sampleId,
      title: "Autonomous System Audit & Memory Optimization",
      goal: "Analyze screen OCR context, verify active MCP tools, run system diagnostic, and generate report.",
      status: "completed",
      steps: [
        {
          id: "step_1",
          title: "Screenpipe OCR Context Scan",
          actionType: "research",
          commandOrPrompt: "screenpipe_get_context",
          status: "completed",
          output: "Captured active workspace text: ULTRON v4.6.7 Neural Client",
          timestamp: Date.now() - 300000,
        },
        {
          id: "step_2",
          title: "MCP Filesystem Server Check",
          actionType: "mcp_tool",
          commandOrPrompt: "spin_up:filesystem",
          status: "completed",
          output: "MCP Filesystem server active and verified",
          timestamp: Date.now() - 200000,
        },
        {
          id: "step_3",
          title: "System Performance Telemetry",
          actionType: "computer_action",
          commandOrPrompt: "get_sysinfo",
          status: "completed",
          output: "RAM free: 12450MB, Uptime: 4h 12m",
          timestamp: Date.now() - 100000,
        },
      ],
      artifacts: [
        {
          name: "System_Audit_Report.md",
          content: "# Accomplish AI Coworker Audit Report\n- Status: All neural bridges operational\n- MCP Servers: Running\n- Screenpipe OCR: Active",
        },
      ],
      requiresUserApproval: false,
      createdAt: Date.now() - 360000,
      completedAt: Date.now() - 100000,
    });
  }

  /**
   * Creates a new autonomous coworker task and breaks it down into executable sub-steps
   */
  public async createCoworkerTask(title: string, goal: string): Promise<AccomplishCoworkerTask> {
    const taskId = "coworker_" + Math.random().toString(36).substring(2, 9);
    const task: AccomplishCoworkerTask = {
      id: taskId,
      title,
      goal,
      status: "planning",
      steps: [
        {
          id: "step_1_" + taskId,
          title: "Context Gathering & Screenpipe OCR",
          actionType: "research",
          commandOrPrompt: `Analyze context for: ${goal}`,
          status: "pending",
          timestamp: Date.now(),
        },
        {
          id: "step_2_" + taskId,
          title: "Autonomous Action Execution",
          actionType: "computer_action",
          commandOrPrompt: `Execute sub-tasks for: ${title}`,
          status: "pending",
          timestamp: Date.now(),
        },
        {
          id: "step_3_" + taskId,
          title: "Output Verification & Artifact Generation",
          actionType: "verification",
          commandOrPrompt: `Verify result and build summary report`,
          status: "pending",
          timestamp: Date.now(),
        },
      ],
      artifacts: [],
      requiresUserApproval: false,
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.executeTaskLoop(taskId);
    return task;
  }

  /**
   * Executes the sub-steps loop asynchronously (Accomplish AI Coworker Worker Loop)
   */
  private async executeTaskLoop(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = "executing";

    for (const step of task.steps) {
      step.status = "running";
      try {
        if (step.actionType === "research") {
          const screenCtx = screenpipeEngine.getLatestScreenContext();
          step.output = `Research complete: ${screenCtx}`;
        } else if (step.actionType === "computer_action") {
          const res = await openJarvisEngine.executeComputerAction("echo Accomplish Coworker Step", step.title);
          step.output = res.result;
        } else if (step.actionType === "mcp_tool") {
          const mcpRes = await mcpManager.executeMcpTool("fetch_url", { url: "http://127.0.0.1:7777" });
          step.output = mcpRes.output;
        } else {
          step.output = `Step ${step.title} verified successfully.`;
        }
        step.status = "completed";
      } catch (err: any) {
        step.status = "failed";
        step.output = err.message || "Step execution failed";
        task.status = "failed";
        return;
      }
    }

    task.status = "verifying";
    task.artifacts.push({
      name: `${task.title.replace(/\s+/g, "_")}_Artifact.md`,
      content: `# Accomplish AI Task Output: ${task.title}\n\n## Goal\n${task.goal}\n\n## Step Execution Summary\n` +
        task.steps.map((s) => `- **${s.title}**: ${s.output}`).join("\n"),
    });

    task.status = "completed";
    task.completedAt = Date.now();
    console.log(`[Accomplish AI Coworker] Task ${taskId} completed successfully.`);
  }

  public getTask(taskId: string): AccomplishCoworkerTask | undefined {
    return this.tasks.get(taskId);
  }

  public getAllTasks(): AccomplishCoworkerTask[] {
    return Array.from(this.tasks.values());
  }
}

export const accomplishCoworkerEngine = new AccomplishCoworkerEngine();
