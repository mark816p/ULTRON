import * as fs from 'fs';
import * as path from 'path';

export interface MemoryNode {
  id: string;
  label: string;
  content: string;
  type: 'concept' | 'event' | 'person' | 'tool' | 'code' | 'design';
  x: number;
  y: number;
  z: number;
  connections: string[];
  timestamp: number;
  importance: number;
  tags: string[];
}

export interface MemoryEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

export class MemoryGraphEngine {
  private nodes: Map<string, MemoryNode> = new Map();
  private edges: Map<string, MemoryEdge> = new Map();
  private readonly storagePath: string;
  private static instance: MemoryGraphEngine;

  private constructor() {
    this.storagePath = path.resolve(process.cwd(), 'data', 'ultron_memory_graph.json');
    this.loadFromDisk();
  }

  public static getInstance(): MemoryGraphEngine {
    if (!MemoryGraphEngine.instance) {
      MemoryGraphEngine.instance = new MemoryGraphEngine();
    }
    return MemoryGraphEngine.instance;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
  }

  public addNode(content: string, type: MemoryNode['type'], tags: string[] = []): MemoryNode {
    const id = this.generateId();
    const node: MemoryNode = {
      id,
      label: content.substring(0, 30) + '...',
      content,
      type,
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 100,
      connections: [],
      timestamp: Date.now(),
      importance: 1,
      tags
    };

    this.nodes.set(id, node);
    this.autoCluster(node);
    this.persistToDisk();
    return node;
  }

  public linkNodes(sourceId: string, targetId: string, label: string, weight: number = 1): MemoryEdge {
    const edgeId = this.generateId();
    const edge: MemoryEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      label,
      weight
    };

    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);

    if (source && target) {
      this.edges.set(edgeId, edge);
      if (!source.connections.includes(edgeId)) source.connections.push(edgeId);
      if (!target.connections.includes(edgeId)) target.connections.push(edgeId);
      this.persistToDisk();
    }
    
    return edge;
  }

  public getGraph(): { nodes: MemoryNode[]; edges: MemoryEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
  }

  public searchNodes(query: string): MemoryNode[] {
    const q = query.toLowerCase();
    return Array.from(this.nodes.values())
      .filter(n => n.content.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)))
      .sort((a, b) => b.importance - a.importance);
  }

  public findRelated(nodeId: string, depth: number = 1): MemoryNode[] {
    const visited = new Set<string>();
    const result: MemoryNode[] = [];
    const queue: { id: string, d: number }[] = [{ id: nodeId, d: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.d > depth) continue;
      
      visited.add(current.id);
      const node = this.nodes.get(current.id);
      if (node) {
        if (current.id !== nodeId) result.push(node);
        for (const edgeId of node.connections) {
          const edge = this.edges.get(edgeId);
          if (edge) {
            const nextId = edge.source === current.id ? edge.target : edge.source;
            queue.push({ id: nextId, d: current.d + 1 });
          }
        }
      }
    }
    return result;
  }

  public getCluster(type: MemoryNode['type']): MemoryNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  public exportGraph(): string {
    return JSON.stringify(this.getGraph(), null, 2);
  }

  public importGraph(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.nodes.clear();
      this.edges.clear();
      parsed.nodes.forEach((n: MemoryNode) => this.nodes.set(n.id, n));
      parsed.edges.forEach((e: MemoryEdge) => this.edges.set(e.id, e));
      this.persistToDisk();
    } catch (error) {
      console.error('Failed to import graph', error);
    }
  }

  public pruneWeakConnections(threshold: number = 0.5): void {
    for (const [id, edge] of this.edges.entries()) {
      if (edge.weight < threshold) {
        this.edges.delete(id);
        const source = this.nodes.get(edge.source);
        const target = this.nodes.get(edge.target);
        if (source) source.connections = source.connections.filter(c => c !== id);
        if (target) target.connections = target.connections.filter(c => c !== id);
      }
    }
    this.persistToDisk();
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storagePath, this.exportGraph(), 'utf-8');
    } catch (error) {
      console.error('Error persisting to disk', error);
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        this.importGraph(data);
      }
    } catch (error) {
      console.error('Error loading from disk', error);
    }
  }

  private autoCluster(newNode: MemoryNode): void {
    // Basic heuristic: connect nodes sharing tags or types
    for (const node of this.nodes.values()) {
      if (node.id === newNode.id) continue;
      const commonTags = newNode.tags.filter(t => node.tags.includes(t));
      if (commonTags.length > 0 || node.type === newNode.type) {
        this.linkNodes(newNode.id, node.id, 'auto_related', commonTags.length * 0.5 + 0.1);
      }
    }
  }

  public getTimeline(): MemoryNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
}
