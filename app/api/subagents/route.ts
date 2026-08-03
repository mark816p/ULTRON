import { NextResponse } from 'next/server';
import { AiRouter } from '@/lib/aiRouter';
import { UltronTools } from '@/lib/tools';

declare global {
  var subAgentOrchestrator: any;
}

if (!globalThis.subAgentOrchestrator) {
  globalThis.subAgentOrchestrator = {
    agents: new Map(),
    history: []
  };
}

export async function GET(request: Request) {
  const agents = Array.from(globalThis.subAgentOrchestrator.agents.values());
  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'list': {
        const agents = Array.from(globalThis.subAgentOrchestrator.agents.values());
        return NextResponse.json({ agents });
      }
      
      case 'spawn': {
        const { name, role, task, instructions } = body;
        const id = Math.random().toString(36).substring(2, 15);
        const newAgent = { id, name, role, task, instructions, status: 'running', createdAt: Date.now() };
        globalThis.subAgentOrchestrator.agents.set(id, newAgent);
        
        // Asynchronously execute
        executeAgent(id, newAgent).catch(console.error);

        return NextResponse.json({ success: true, agent: newAgent });
      }

      case 'kill': {
        const { agentId } = body;
        if (globalThis.subAgentOrchestrator.agents.has(agentId)) {
          const agent = globalThis.subAgentOrchestrator.agents.get(agentId);
          agent.status = 'killed';
          globalThis.subAgentOrchestrator.agents.set(agentId, agent);
          return NextResponse.json({ success: true, message: `Agent ${agentId} killed` });
        }
        return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
      }

      case 'orchestrate': {
        const { mainGoal } = body;
        // Mocking AI Router breaking into subtasks
        const subtasks = [
          { name: 'Research', role: 'Researcher', task: `Research topics for: ${mainGoal}` },
          { name: 'Implement', role: 'Developer', task: `Implement findings for: ${mainGoal}` }
        ];

        const spawnedAgents = [];
        for (const st of subtasks) {
          const id = Math.random().toString(36).substring(2, 15);
          const newAgent = { id, name: st.name, role: st.role, task: st.task, status: 'running', createdAt: Date.now() };
          globalThis.subAgentOrchestrator.agents.set(id, newAgent);
          spawnedAgents.push(newAgent);
          executeAgent(id, newAgent).catch(console.error);
        }

        return NextResponse.json({ success: true, mainGoal, spawnedAgents });
      }

      case 'synthesize': {
        const { agentIds } = body;
        const results = [];
        for (const id of agentIds) {
          if (globalThis.subAgentOrchestrator.agents.has(id)) {
            const agent = globalThis.subAgentOrchestrator.agents.get(id);
            results.push({ id, role: agent.role, result: agent.result || 'No result yet' });
          }
        }
        return NextResponse.json({ success: true, synthesis: 'Synthesized successfully', details: results });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function executeAgent(id: string, agent: any) {
  // Mock execution using AiRouter (if available) and UltronTools
  try {
    // In a real scenario, we'd use AiRouter to get completion based on tools
    await new Promise(resolve => setTimeout(resolve, 2000));
    agent.status = 'completed';
    agent.result = `Completed task: ${agent.task} successfully.`;
    globalThis.subAgentOrchestrator.agents.set(id, agent);
  } catch (e) {
    agent.status = 'failed';
    globalThis.subAgentOrchestrator.agents.set(id, agent);
  }
}
