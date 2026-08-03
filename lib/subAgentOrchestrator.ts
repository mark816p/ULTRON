import { MemoryGraphEngine } from './memoryGraph';

export interface SubAgent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'running' | 'done' | 'error';
  task: string;
  result?: any;
  startedAt: number;
  completedAt?: number;
  parentAgentId?: string;
}

export class SubAgentOrchestrator {
  private static instance: SubAgentOrchestrator;
  private agentQueue: SubAgent[] = [];
  private activeAgents: Map<string, SubAgent> = new Map();
  private completedAgents: Map<string, SubAgent> = new Map();
  private memoryGraph: MemoryGraphEngine;

  private availableRoles = ['researcher', 'coder', 'designer', 'analyst', 'browser-agent', 'system-controller', 'memory-manager', '3d-designer'];

  private constructor() {
    this.memoryGraph = MemoryGraphEngine.getInstance();
  }

  public static getInstance(): SubAgentOrchestrator {
    if (!SubAgentOrchestrator.instance) {
      SubAgentOrchestrator.instance = new SubAgentOrchestrator();
    }
    return SubAgentOrchestrator.instance;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  public spawnAgent(name: string, role: string, task: string, instructions: string, parentAgentId?: string): SubAgent {
    const id = this.generateId();
    const agent: SubAgent = {
      id,
      name,
      role,
      status: 'running',
      task,
      startedAt: Date.now(),
      parentAgentId
    };

    this.activeAgents.set(id, agent);
    
    // Simulate async AI router call
    setTimeout(() => {
      // Dummy execution
      agent.status = 'done';
      agent.result = `Simulated execution of ${role} for task: ${task}`;
      agent.completedAt = Date.now();
      
      this.activeAgents.delete(id);
      this.completedAgents.set(id, agent);
      
      // Integrate results into memory
      this.memoryGraph.addNode(agent.result, 'event', [role, 'subagent']);
    }, Math.random() * 2000 + 1000);

    return agent;
  }

  public getAgent(id: string): SubAgent | undefined {
    return this.activeAgents.get(id) || this.completedAgents.get(id) || this.agentQueue.find(a => a.id === id);
  }

  public listAgents(): SubAgent[] {
    return [...this.agentQueue, ...Array.from(this.activeAgents.values()), ...Array.from(this.completedAgents.values())];
  }

  public killAgent(id: string): boolean {
    if (this.activeAgents.has(id)) {
      const agent = this.activeAgents.get(id)!;
      agent.status = 'error';
      agent.result = 'Terminated by orchestrator';
      agent.completedAt = Date.now();
      this.activeAgents.delete(id);
      this.completedAgents.set(id, agent);
      return true;
    }
    return false;
  }

  public async waitForAgent(id: string, timeoutMs: number = 30000): Promise<SubAgent> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const agent = this.getAgent(id);
        if (!agent) {
          clearInterval(interval);
          reject(new Error(`Agent ${id} not found`));
        } else if (agent.status === 'done' || agent.status === 'error') {
          clearInterval(interval);
          resolve(agent);
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for agent ${id}`));
        }
      }, 500);
    });
  }

  public delegateTask(task: string, availableRoles: string[] = this.availableRoles): SubAgent {
    // Simple mock heuristic for picking a role based on keywords
    let pickedRole = 'system-controller';
    if (task.toLowerCase().includes('code') || task.toLowerCase().includes('develop')) pickedRole = 'coder';
    else if (task.toLowerCase().includes('design')) pickedRole = 'designer';
    else if (task.toLowerCase().includes('research') || task.toLowerCase().includes('find')) pickedRole = 'researcher';

    return this.spawnAgent(`Agent_${pickedRole}_${this.generateId()}`, pickedRole, task, `Execute delegated task: ${task}`);
  }

  public async orchestrate(mainGoal: string): Promise<any> {
    // Mocking breakdown of goals
    const tasks = [
      `Analyze: ${mainGoal}`,
      `Plan: ${mainGoal}`,
      `Execute: ${mainGoal}`
    ];
    
    const agentIds: string[] = [];
    for (const task of tasks) {
      const agent = this.delegateTask(task);
      agentIds.push(agent.id);
    }
    
    // Wait for all to finish
    await Promise.all(agentIds.map(id => this.waitForAgent(id)));
    
    return this.synthesizeResults(agentIds);
  }

  public synthesizeResults(agentIds: string[]): string {
    const results = agentIds.map(id => {
      const agent = this.completedAgents.get(id);
      return agent ? `[${agent.role}] ${agent.task} -> ${agent.result}` : `[Unknown] Failed to retrieve result for ${id}`;
    });
    
    return `Synthesized Report:\n${results.join('\n')}`;
  }
}
