'use client';
import React from 'react';

export default function AgentWorkspace() {
  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#050508', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden'
    }}>
      {/* Header / Status Bar */}
      <div style={{
        height: '40px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(0,255,255,0.2)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: '20px', fontSize: '12px'
      }}>
        <span style={{ color: '#00ffff', fontWeight: 'bold' }}>ULTRON WORKSPACE</span>
        <span>Active Agents: 3</span>
        <span>Tasks: 12/45</span>
        <span>Tokens: 142k</span>
        <span>Elapsed: 00:15:42</span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Task Tree */}
        <div style={{
          width: '250px', background: 'rgba(0,0,0,0.5)', borderRight: '1px solid rgba(255,255,255,0.1)',
          padding: '16px', overflowY: 'auto'
        }}>
          <h3 style={{ fontSize: '14px', color: '#888', margin: '0 0 12px 0' }}>TASK PIPELINE</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ color: '#00ff00' }}>✓ Initialize Workspace</div>
            <div style={{ color: '#00ffff', paddingLeft: '16px' }}>⟳ Build MemoryMap component</div>
            <div style={{ color: '#888', paddingLeft: '16px' }}>○ Build SubAgent component</div>
            <div style={{ color: '#888', paddingLeft: '16px' }}>○ Build Workspace component</div>
          </div>
        </div>

        {/* Center: Thinking Stream & Flow Diagram */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Abstract 3D Flow visualization area placeholder */}
          <div style={{
            height: '40%', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'radial-gradient(circle at center, rgba(0,255,255,0.1) 0%, transparent 70%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
          }}>
            <div style={{ position: 'absolute', color: '#00ffff', opacity: 0.3, fontSize: '10px', top: '10px', left: '10px' }}>3D AGENT PIPELINE VISUALIZATION</div>
            {/* Fake nodes representing pipeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00ffff', boxShadow: '0 0 20px #00ffff' }}></div>
              <div style={{ height: '2px', width: '60px', background: 'linear-gradient(90deg, #00ffff, #0088ff)' }}></div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0088ff', boxShadow: '0 0 20px #0088ff' }}></div>
              <div style={{ height: '2px', width: '60px', background: 'linear-gradient(90deg, #0088ff, #ff00ff)' }}></div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ff00ff', boxShadow: '0 0 20px #ff00ff', opacity: 0.5 }}></div>
            </div>
          </div>

          {/* Thinking stream */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '14px', color: '#00ffff', margin: '0 0 16px 0' }}>AI REASONING STREAM</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
              <div style={{ color: '#aaa' }}>&gt; Analyzing user request...</div>
              <div style={{ color: '#aaa' }}>&gt; Breaking down tasks for Ultron OS components.</div>
              <div style={{ color: '#00ff00' }}>&gt; Spawning sub-agent for MemoryMapPanel visualization.</div>
              <div style={{ background: 'rgba(0,255,255,0.1)', padding: '12px', borderLeft: '2px solid #00ffff', color: '#ddd' }}>
                "I will use Canvas 2D to create a performant glowing network graph. It will support drag-and-drop, zooming, and smooth animations to give it a futuristic 3D feel without the overhead of heavy WebGL libraries if not necessary."
              </div>
            </div>
          </div>

          {/* Instruction Input */}
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.8)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <input 
              type="text" 
              placeholder="Direct the orchestrator..." 
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,255,255,0.3)',
                padding: '12px 16px', borderRadius: '8px', color: '#fff', outline: 'none',
                boxShadow: 'inset 0 0 10px rgba(0,255,255,0.1)'
              }}
            />
          </div>
        </div>

        {/* Right: Tool Calls & Live Log */}
        <div style={{
          width: '300px', background: 'rgba(0,0,0,0.5)', borderLeft: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', flex: 1 }}>
            <h3 style={{ fontSize: '14px', color: '#888', margin: '0 0 12px 0' }}>ACTIVE TOOL CALLS</h3>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', fontSize: '12px', border: '1px solid rgba(255,0,255,0.3)' }}>
              <div style={{ color: '#ff00ff', fontWeight: 'bold', marginBottom: '8px' }}>write_to_file</div>
              <div style={{ color: '#aaa', fontFamily: 'monospace' }}>Target: components/MemoryMapPanel.tsx</div>
              <div style={{ color: '#aaa', fontFamily: 'monospace' }}>Status: executing...</div>
            </div>
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            <h3 style={{ fontSize: '14px', color: '#888', margin: '0 0 12px 0' }}>LIVE SYSTEM LOG</h3>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#666', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>[19:25:33] OS init complete</div>
              <div>[19:25:34] Loaded plugins: 12</div>
              <div>[19:25:35] Auth verified</div>
              <div style={{ color: '#00ffff' }}>[19:25:36] Orchestrator spawned</div>
              <div>[19:25:37] FS read: package.json</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
