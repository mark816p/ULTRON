import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

declare global {
  var memoryGraphNodes: Map<string, any>;
  var memoryGraphEdges: Map<string, any>;
}

if (!globalThis.memoryGraphNodes) {
  globalThis.memoryGraphNodes = new Map();
  globalThis.memoryGraphEdges = new Map();
  loadGraphFromDisk();
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'memory_graph.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadGraphFromDisk() {
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      globalThis.memoryGraphNodes = new Map(data.nodes.map((n: any) => [n.id, n]));
      globalThis.memoryGraphEdges = new Map(data.edges.map((e: any) => [e.id, e]));
    } catch (e) {
      console.error('Failed to load memory graph', e);
    }
  }
}

function saveGraphToDisk() {
  ensureDataDir();
  const data = {
    nodes: Array.from(globalThis.memoryGraphNodes.values()),
    edges: Array.from(globalThis.memoryGraphEdges.values())
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const search = searchParams.get('search');
  const nodeId = searchParams.get('nodeId');
  const depth = searchParams.get('depth') ? parseInt(searchParams.get('depth') as string, 10) : 1;

  let nodes = Array.from(globalThis.memoryGraphNodes.values());
  let edges = Array.from(globalThis.memoryGraphEdges.values());

  if (type) {
    const types = type.split(',');
    nodes = nodes.filter(n => types.includes(n.type));
  }

  if (search) {
    const q = search.toLowerCase();
    nodes = nodes.filter(n => n.label.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q)));
  }

  if (nodeId && globalThis.memoryGraphNodes.has(nodeId)) {
    // Simple 1-depth relation for now
    const relatedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
    const relatedNodeIds = new Set(relatedEdges.flatMap(e => [e.source, e.target]));
    nodes = Array.from(globalThis.memoryGraphNodes.values()).filter(n => relatedNodeIds.has(n.id));
    edges = relatedEdges;
  }

  return NextResponse.json({ nodes, edges });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'add-node': {
        const { content, type, tags, label } = body;
        const id = Math.random().toString(36).substring(2, 15);
        const node = {
          id,
          label: label || content.substring(0, 20),
          content,
          type: type || 'concept',
          x: (Math.random() * 200) - 100,
          y: (Math.random() * 200) - 100,
          z: (Math.random() * 200) - 100,
          connections: [],
          timestamp: Date.now(),
          importance: 1,
          tags: tags || []
        };
        globalThis.memoryGraphNodes.set(id, node);
        saveGraphToDisk();
        return NextResponse.json({ success: true, node });
      }

      case 'link-nodes': {
        const { sourceId, targetId, label, weight = 1 } = body;
        if (!globalThis.memoryGraphNodes.has(sourceId) || !globalThis.memoryGraphNodes.has(targetId)) {
          return NextResponse.json({ error: 'Nodes not found' }, { status: 404 });
        }
        const id = `${sourceId}-${targetId}`;
        const edge = { id, source: sourceId, target: targetId, label: label || '', weight };
        globalThis.memoryGraphEdges.set(id, edge);
        saveGraphToDisk();
        return NextResponse.json({ success: true, edge });
      }

      case 'search': {
        const { query } = body;
        const q = query.toLowerCase();
        const nodes = Array.from(globalThis.memoryGraphNodes.values()).filter(n => 
          n.label.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q))
        );
        return NextResponse.json({ success: true, nodes });
      }

      case 'prune': {
        const { threshold = 0.5 } = body;
        let pruned = 0;
        for (const [id, edge] of globalThis.memoryGraphEdges.entries()) {
          if (edge.weight < threshold) {
            globalThis.memoryGraphEdges.delete(id);
            pruned++;
          }
        }
        saveGraphToDisk();
        return NextResponse.json({ success: true, pruned });
      }

      case 'export': {
        return NextResponse.json({ 
          nodes: Array.from(globalThis.memoryGraphNodes.values()),
          edges: Array.from(globalThis.memoryGraphEdges.values())
        });
      }

      case 'get-timeline': {
        const nodes = Array.from(globalThis.memoryGraphNodes.values()).sort((a, b) => a.timestamp - b.timestamp);
        return NextResponse.json({ success: true, timeline: nodes });
      }

      case 'import': {
        const { graphData } = body;
        if (graphData && graphData.nodes && graphData.edges) {
          globalThis.memoryGraphNodes = new Map(graphData.nodes.map((n: any) => [n.id, n]));
          globalThis.memoryGraphEdges = new Map(graphData.edges.map((e: any) => [e.id, e]));
          saveGraphToDisk();
          return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Invalid graph data' }, { status: 400 });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
