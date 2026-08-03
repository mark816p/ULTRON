'use client';
import React, { useState } from 'react';

interface SubAgent {
  id: string;
  name: string;
  role: string;
  task: string;
  status: 'idle' | 'running' | 'done' | 'error';
  elapsedTime: string;
  resultPreview?: string;
  messages: string[];
}

const statusColors = {
  idle: '#888888',
  running: '#00ffff',
  done: '#00ff00',
  error: '#ff0000'
};

export default function SubAgentPanel() {
  const [agents, setAgents] = useState<SubAgent[]>([
    { id: '1', name: 'Alpha', role: 'researcher', task: 'Find 3D models', status: 'running', elapsedTime: '00:02:34', messages: ['Searching...', 'Found 5 items'] },
    { id: '2', name: 'Beta', role: 'coder', task: 'Implement Three.js logic', status: 'done', elapsedTime: '00:05:12', resultPreview: 'Completed OrbScene', messages: ['Writing code...', 'Success'] }
  ]);
  const [goal, setGoal] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const roles = ['researcher', 'coder', 'designer', 'analyst', 'browser-agent', 'system-controller', 'memory-manager', '3d-designer'];

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px',
      background: 'rgba(10, 15, 20, 0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0, 255, 255, 0.15)', borderRadius: '16px',
      color: '#fff', fontFamily: 'sans-serif', padding: '20px', boxSizing: 'border-box', overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.5)' }}>Sub-Agent Swarm</h2>
        <span style={{ background: 'rgba(0,255,255,0.1)', padding: '4px 12px', borderRadius: '12px', fontSize: '12px' }}>
          Active: {agents.filter(a => a.status === 'running').length} / {agents.length}
        </span>
      </div>

      <div style={{
        background: 'rgba(0, 0, 0, 0.4)', borderRadius: '12px', padding: '16px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#aaa' }}>Orchestrate Goal</h3>
        <textarea 
          value={goal} onChange={e => setGoal(e.target.value)}
          placeholder="Describe a complex goal to automatically spawn multiple agents..."
          style={{
            width: '100%', height: '80px', background: 'rgba(255,255,255,0.05)', 
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', 
            padding: '10px', boxSizing: 'border-box', resize: 'none', marginBottom: '12px'
          }}
        />
        <button style={{
          background: 'linear-gradient(90deg, #0088ff, #00ffff)', border: 'none', width: '100%',
          color: '#000', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
        }}>
          AUTO-ORCHESTRATE SWARM
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {agents.map(agent => (
          <div key={agent.id} 
            onClick={() => setExpandedId(expandedId === agent.id ? null : agent.id)}
            style={{
            background: 'rgba(255, 255, 255, 0.03)', border: `1px solid ${statusColors[agent.status]}55`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: agent.status === 'running' ? `0 0 15px ${statusColors[agent.status]}22` : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%', background: statusColors[agent.status],
                  boxShadow: `0 0 8px ${statusColors[agent.status]}`
                }} />
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{agent.name}</span>
                <span style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase' }}>{agent.role}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{agent.elapsedTime}</span>
                {agent.status === 'running' && (
                  <button onClick={(e) => e.stopPropagation()} style={{
                    background: 'rgba(255,0,0,0.2)', border: '1px solid red', color: '#ffaaaa',
                    padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                  }}>KILL</button>
                )}
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#ddd' }}>{agent.task}</div>
            
            {expandedId === agent.id && (
              <div style={{
                marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)',
                display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <div style={{ fontSize: '12px', color: '#888' }}>Result Preview:</div>
                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '4px', fontSize: '13px' }}>
                  {agent.resultPreview || 'No result yet...'}
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>Communication Log:</div>
                <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '4px', fontSize: '12px', maxHeight: '100px', overflowY: 'auto' }}>
                  {agent.messages.map((m, i) => <div key={i} style={{ marginBottom: '4px' }}>&gt; {m}</div>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
