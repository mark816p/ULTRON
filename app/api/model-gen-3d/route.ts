import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MODELS_DIR = path.join(process.cwd(), 'data', 'models');

function ensureDir() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

export async function GET(request: Request) {
  ensureDir();
  const files = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.glb') || f.endsWith('.gltf') || f.endsWith('.obj'));
  
  return NextResponse.json({
    providers: [
      { name: 'Meshy AI', api: 'https://api.meshy.ai' },
      { name: 'Tripo3D', api: 'https://api.tripo3d.ai' },
      { name: 'Local Fallback', api: 'threejs' }
    ],
    generatedModels: files,
    storageInfo: { dir: MODELS_DIR, count: files.length }
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, prompt, taskId, provider, format = 'glb' } = body;

    switch (action) {
      case 'list': {
        ensureDir();
        const files = fs.readdirSync(MODELS_DIR);
        return NextResponse.json({ success: true, files });
      }

      case 'generate': {
        if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
        
        if (provider === 'meshy' && process.env.MESHY_API_KEY) {
          const res = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.MESHY_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'preview', prompt })
          });
          const data = await res.json();
          return NextResponse.json({ success: true, taskId: data.result, provider: 'meshy' });
        } 
        
        if (provider === 'tripo' && process.env.TRIPO_API_KEY) {
          const res = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.TRIPO_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'text_to_model', prompt })
          });
          const data = await res.json();
          return NextResponse.json({ success: true, taskId: data.data?.task_id, provider: 'tripo' });
        }

        // Fallback
        const fakeTaskId = `local-${Math.random().toString(36).substring(2, 10)}`;
        return NextResponse.json({ 
          success: true, 
          taskId: fakeTaskId, 
          provider: 'fallback', 
          message: 'Using programmatic Three.js fallback' 
        });
      }

      case 'check-status': {
        if (!taskId) return NextResponse.json({ error: 'Task ID required' }, { status: 400 });

        if (provider === 'meshy' && process.env.MESHY_API_KEY) {
          const res = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${taskId}`, {
            headers: { 'Authorization': `Bearer ${process.env.MESHY_API_KEY}` }
          });
          const data = await res.json();
          return NextResponse.json({ success: true, status: data.status, model_urls: data.model_urls });
        }

        if (provider === 'tripo' && process.env.TRIPO_API_KEY) {
          const res = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
            headers: { 'Authorization': `Bearer ${process.env.TRIPO_API_KEY}` }
          });
          const data = await res.json();
          return NextResponse.json({ success: true, status: data.data?.status, result: data.data?.result });
        }

        return NextResponse.json({ success: true, status: 'SUCCEEDED', modelUrl: 'mock_local_model.glb' });
      }

      case 'download': {
        const { url, filename } = body;
        if (!url || !filename) return NextResponse.json({ error: 'URL and filename required' }, { status: 400 });
        
        ensureDir();
        const filePath = path.join(MODELS_DIR, filename);
        
        // Mock download if it's local fallback
        if (url === 'mock_local_model.glb') {
          fs.writeFileSync(filePath, 'Mock 3D model data');
          return NextResponse.json({ success: true, savedTo: filePath });
        }

        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
        
        return NextResponse.json({ success: true, savedTo: filePath });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
