import React, { useState, useEffect, useRef, useCallback, MouseEvent as ReactMouseEvent } from 'react';

// --- Type Definitions ---
interface GraphNode {
  id: string;
  type: 'concept' | 'event' | 'person' | 'tool' | 'code' | 'design';
  content: string;
  importance: number;
  timestamp: string;
  tags?: string[];
  connectionsCount?: number;
  // Layout properties
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface MemoryMapPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- Constants & Config ---
const NODE_COLORS: Record<string, string> = {
  concept: '#00e5ff',
  event: '#ff8c00',
  person: '#00ff66',
  tool: '#9900ff',
  code: '#0066ff',
  design: '#ff0066',
};

const SIMULATION_CONFIG = {
  repulsion: 2000,
  attraction: 0.01,
  damping: 0.8,
  idealEdgeLength: 100,
  maxSpeed: 10,
};

// --- Component ---
export default function MemoryMapPanel({ isOpen, onClose }: MemoryMapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  // --- State ---
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [filteredData, setFilteredData] = useState<GraphData>({ nodes: [], edges: [] });
  
  // Graph interaction state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // UI state
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Dragging state
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startTransformX: 0,
    startTransformY: 0,
    nodeDragging: false,
    draggedNodeId: null as string | null
  });

  const timeRef = useRef(0);

  // --- Data Fetching ---
  useEffect(() => {
    if (!isOpen) return;

    const fetchGraphData = async () => {
      setIsLoading(true);
      try {
        // Fallback mock data if API fails or isn't implemented
        const mockNodes: GraphNode[] = Array.from({ length: 50 }).map((_, i) => ({
          id: `node-${i}`,
          type: ['concept', 'event', 'person', 'tool', 'code', 'design'][Math.floor(Math.random() * 6)] as any,
          content: `Sample Memory Node ${i}\nThis contains important context about the project.`,
          importance: Math.random(),
          timestamp: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
          tags: ['test', 'mock', `tag${i % 5}`],
          connectionsCount: 0,
          x: Math.random() * 800 - 400,
          y: Math.random() * 600 - 300,
          vx: 0,
          vy: 0
        }));

        const mockEdges: GraphEdge[] = [];
        for (let i = 0; i < 60; i++) {
          const source = mockNodes[Math.floor(Math.random() * mockNodes.length)].id;
          const target = mockNodes[Math.floor(Math.random() * mockNodes.length)].id;
          if (source !== target && !mockEdges.find(e => e.source === source && e.target === target)) {
            mockEdges.push({
              id: `edge-${i}`,
              source,
              target,
              weight: Math.random()
            });
          }
        }

        mockNodes.forEach(n => {
          n.connectionsCount = mockEdges.filter(e => e.source === n.id || e.target === n.id).length;
        });

        // Try to fetch real data
        try {
          const res = await fetch('/api/memory-graph');
          if (res.ok) {
            const apiData = await res.json();
            // Initialize positions if missing
            apiData.nodes.forEach((n: any) => {
              if (n.x === undefined) {
                n.x = Math.random() * 800 - 400;
                n.y = Math.random() * 600 - 300;
              }
              n.vx = 0; n.vy = 0;
            });
            setData(apiData);
            return;
          }
        } catch (e) {
          console.warn('API /api/memory-graph not available, using mock data');
        }

        setData({ nodes: mockNodes, edges: mockEdges });
      } catch (err) {
        console.error('Failed to load memory graph', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraphData();
  }, [isOpen]);

  // --- Filtering & Search ---
  useEffect(() => {
    let nodes = data.nodes;
    if (activeFilter !== 'All') {
      nodes = nodes.filter(n => n.type === activeFilter.toLowerCase());
    }
    
    // Connected edges based on filtered nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = data.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    
    setFilteredData({ nodes, edges });
  }, [data, activeFilter]);

  // --- Force Directed Layout Simulation ---
  const simulateLayout = useCallback(() => {
    if (filteredData.nodes.length === 0) return;

    const { nodes, edges } = filteredData;
    const { repulsion, attraction, damping, idealEdgeLength, maxSpeed } = SIMULATION_CONFIG;

    // Apply forces
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      if (dragRef.current.nodeDragging && dragRef.current.draggedNodeId === n1.id) continue;

      let fx = 0, fy = 0;

      // Repulsion between all nodes
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const n2 = nodes[j];
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 0.01;
        
        // Repulsion force
        if (dist < 400) {
          const force = repulsion / distSq;
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        if (edge.source === n1.id || edge.target === n1.id) {
          const targetId = edge.source === n1.id ? edge.target : edge.source;
          const n2 = nodes.find(n => n.id === targetId);
          if (n2) {
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            
            // Hooke's law: force proportional to distance from ideal length
            const diff = dist - idealEdgeLength;
            const force = diff * attraction * edge.weight;
            
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          }
        }
      });

      // Central gravity to keep graph from flying away
      fx += (0 - n1.x) * 0.001;
      fy += (0 - n1.y) * 0.001;

      // Update velocity
      n1.vx = (n1.vx + fx) * damping;
      n1.vy = (n1.vy + fy) * damping;

      // Limit speed
      const speed = Math.sqrt(n1.vx * n1.vx + n1.vy * n1.vy);
      if (speed > maxSpeed) {
        n1.vx = (n1.vx / speed) * maxSpeed;
        n1.vy = (n1.vy / speed) * maxSpeed;
      }

      // Update position
      n1.x += n1.vx;
      n1.y += n1.vy;
    }
  }, [filteredData]);

  // Initial heavy simulation
  useEffect(() => {
    for (let i = 0; i < 100; i++) {
      simulateLayout();
    }
  }, [data]); // Run when data changes

  // --- Rendering Loop ---
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resize
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const { width, height } = canvas;
    timeRef.current += 0.016; // Approx 60fps
    const time = timeRef.current;

    // Background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    // Apply transform
    ctx.save();
    ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Draw Edges
    filteredData.edges.forEach(edge => {
      const sourceNode = filteredData.nodes.find(n => n.id === edge.source);
      const targetNode = filteredData.nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return;

      const isConnectedToSelected = selectedNodeId === sourceNode.id || selectedNodeId === targetNode.id;
      const isConnectedToHovered = hoveredNodeId === sourceNode.id || hoveredNodeId === targetNode.id;
      
      let opacity = 0.2;
      if (selectedNodeId) opacity = isConnectedToSelected ? 0.8 : 0.05;
      else if (hoveredNodeId) opacity = isConnectedToHovered ? 0.6 : 0.1;

      ctx.beginPath();
      ctx.moveTo(sourceNode.x, sourceNode.y);
      ctx.lineTo(targetNode.x, targetNode.y);

      // Edge styling
      ctx.lineWidth = 1 + edge.weight * 2;
      
      // Gradient stroke
      const grad = ctx.createLinearGradient(sourceNode.x, sourceNode.y, targetNode.x, targetNode.y);
      const color1 = NODE_COLORS[sourceNode.type] || '#ffffff';
      const color2 = NODE_COLORS[targetNode.type] || '#ffffff';
      grad.addColorStop(0, `${color1}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`);
      grad.addColorStop(1, `${color2}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`);
      ctx.strokeStyle = grad;

      // Flowing animation if connected to hovered/selected
      if (isConnectedToHovered || isConnectedToSelected) {
        ctx.setLineDash([10, 15]);
        ctx.lineDashOffset = -time * 50;
      } else {
        ctx.setLineDash([]);
      }

      ctx.stroke();
    });
    ctx.setLineDash([]); // reset

    // Draw Nodes
    filteredData.nodes.forEach(node => {
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeId === node.id;
      const isHighlightedBySearch = searchQuery && (node.content.toLowerCase().includes(searchQuery.toLowerCase()) || node.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const baseRadius = 6 + (node.importance * 8);
      // Pulse animation
      const pulse = Math.sin(time * 3 + node.x * 0.1) * 2;
      const radius = baseRadius + (isHovered || isSelected ? 4 : pulse);

      let opacity = 1;
      if (selectedNodeId && !isSelected && !filteredData.edges.some(e => (e.source === selectedNodeId && e.target === node.id) || (e.target === selectedNodeId && e.source === node.id))) {
        opacity = 0.2; // Dim unassociated nodes
      } else if (searchQuery && !isHighlightedBySearch) {
        opacity = 0.1;
      }

      const color = NODE_COLORS[node.type] || '#ffffff';
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.fill();

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // Hub outer ring
      if (node.importance > 0.8 || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6 + (isSelected ? pulse : 0), 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw hover label
      if (isHovered || isSelected || isHighlightedBySearch) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px "Courier New", monospace';
        const label = node.tags?.[0] || node.type.toUpperCase();
        ctx.fillText(label, node.x + radius + 8, node.y + 4);
      }
      ctx.globalAlpha = 1;
    });

    ctx.restore();
    
    // Draw Minimap (top right in this overlay, or separate canvas)
    renderMinimap();

  }, [filteredData, transform, selectedNodeId, hoveredNodeId, searchQuery]);

  const renderMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    const mainCanvas = canvasRef.current;
    if (!canvas || !mainCanvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate bounds of graph
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    if (filteredData.nodes.length > 0) {
      minX = Math.min(...filteredData.nodes.map(n => n.x));
      maxX = Math.max(...filteredData.nodes.map(n => n.x));
      minY = Math.min(...filteredData.nodes.map(n => n.y));
      maxY = Math.max(...filteredData.nodes.map(n => n.y));
    }

    const padding = 50;
    const graphWidth = Math.max(maxX - minX + padding * 2, 1);
    const graphHeight = Math.max(maxY - minY + padding * 2, 1);
    
    const scale = Math.min(canvas.width / graphWidth, canvas.height / graphHeight);
    
    ctx.save();
    // Center map
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);

    // Draw tiny edges
    ctx.beginPath();
    filteredData.edges.forEach(edge => {
      const s = filteredData.nodes.find(n => n.id === edge.source);
      const t = filteredData.nodes.find(n => n.id === edge.target);
      if (s && t) {
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
      }
    });
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    // Draw tiny nodes
    filteredData.nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4 / scale, 0, Math.PI * 2);
      ctx.fillStyle = NODE_COLORS[node.type] || '#fff';
      ctx.fill();
    });

    // Draw Viewport Rect
    ctx.restore();
    
    // Viewport logic
    // Transform maps main canvas center to graph center
    // we need to find what part of graph is visible
    const vpW = mainCanvas.width / transform.scale;
    const vpH = mainCanvas.height / transform.scale;
    const vpX = -transform.x / transform.scale - vpW / 2;
    const vpY = -transform.y / transform.scale - vpH / 2;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(vpX, vpY, vpW, vpH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(vpX, vpY, vpW, vpH);
    ctx.restore();

  }, [filteredData, transform]);


  const animationLoop = useCallback(() => {
    simulateLayout();
    renderCanvas();
    animationRef.current = requestAnimationFrame(animationLoop);
  }, [simulateLayout, renderCanvas]);

  useEffect(() => {
    if (isOpen) {
      animationRef.current = requestAnimationFrame(animationLoop);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isOpen, animationLoop]);

  // --- Interaction Handlers ---
  const screenToGraphPos = (sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    return {
      x: (sx - canvas.width / 2 - transform.x) / transform.scale,
      y: (sy - canvas.height / 2 - transform.y) / transform.scale
    };
  };

  const handleMouseDown = (e: ReactMouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    dragRef.current = {
      isDragging: true,
      startX: x,
      startY: y,
      startTransformX: transform.x,
      startTransformY: transform.y,
      nodeDragging: false,
      draggedNodeId: null
    };

    if (hoveredNodeId) {
      dragRef.current.nodeDragging = true;
      dragRef.current.draggedNodeId = hoveredNodeId;
      setSelectedNodeId(hoveredNodeId);
    }
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x: e.clientX, y: e.clientY });

    const graphPos = screenToGraphPos(x, y);

    if (dragRef.current.isDragging) {
      if (dragRef.current.nodeDragging && dragRef.current.draggedNodeId) {
        // Drag node
        const node = filteredData.nodes.find(n => n.id === dragRef.current.draggedNodeId);
        if (node) {
          node.x = graphPos.x;
          node.y = graphPos.y;
          node.vx = 0;
          node.vy = 0;
        }
      } else {
        // Pan
        setTransform(prev => ({
          ...prev,
          x: dragRef.current.startTransformX + (x - dragRef.current.startX),
          y: dragRef.current.startTransformY + (y - dragRef.current.startY)
        }));
      }
    } else {
      // Hover detection
      let foundHover = null;
      for (const node of filteredData.nodes) {
        const radius = (6 + (node.importance * 8));
        const dx = node.x - graphPos.x;
        const dy = node.y - graphPos.y;
        if (dx * dx + dy * dy < radius * radius * 4) { // generous hit area
          foundHover = node.id;
          break;
        }
      }
      if (foundHover !== hoveredNodeId) {
        setHoveredNodeId(foundHover);
        canvas.style.cursor = foundHover ? 'pointer' : 'default';
      }
    }
  };

  const handleMouseUp = () => {
    dragRef.current.isDragging = false;
    dragRef.current.nodeDragging = false;
    dragRef.current.draggedNodeId = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); // Prevent page scroll
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(transform.scale + delta, 0.1), 5);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleDoubleClick = () => {
    if (hoveredNodeId) {
      const node = filteredData.nodes.find(n => n.id === hoveredNodeId);
      if (node) {
        setTransform({ x: -node.x * transform.scale, y: -node.y * transform.scale, scale: 1.5 });
        setSelectedNodeId(hoveredNodeId);
      }
    } else {
      setTransform({ x: 0, y: 0, scale: 1 });
      setSelectedNodeId(null);
    }
  };

  // --- Add Node Submit ---
  const handleAddNode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newNode: GraphNode = {
      id: `node-${Date.now()}`,
      content: formData.get('content') as string,
      type: formData.get('type') as any,
      tags: (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean),
      importance: 0.5,
      timestamp: new Date().toISOString(),
      connectionsCount: 0,
      x: (Math.random() - 0.5) * 200 - transform.x,
      y: (Math.random() - 0.5) * 200 - transform.y,
      vx: 0, vy: 0
    };

    setData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
    setIsAddingNode(false);
  };

  const selectedNodeData = selectedNodeId ? data.nodes.find(n => n.id === selectedNodeId) : null;

  if (!isOpen) return null;

  // --- Render ---
  return (
    <div style={styles.overlay}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.titleArea}>
          <span style={styles.title}>MEMORY MAP // KNOWLEDGE GRAPH</span>
          <span style={styles.stats}>
            {filteredData.nodes.length} Nodes | {filteredData.edges.length} Edges
          </span>
        </div>
        
        <div style={styles.controls}>
          <input 
            type="text" 
            placeholder="Search map..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={styles.input}
          />
          
          <select 
            value={activeFilter} 
            onChange={e => setActiveFilter(e.target.value)}
            style={styles.select}
          >
            {['All', 'Concept', 'Event', 'Person', 'Tool', 'Code', 'Design'].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <button style={styles.button} onClick={() => setIsAddingNode(true)}>
            + Add Node
          </button>
          <button style={styles.button} onClick={() => {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ultron_memory_graph.json';
            a.click();
          }}>
            Export
          </button>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
      </div>

      {/* Main Canvas */}
      <div 
        ref={containerRef}
        style={styles.canvasContainer}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        />
        
        {/* Hover Tooltip overlay */}
        {hoveredNodeId && !dragRef.current.isDragging && (() => {
          const node = filteredData.nodes.find(n => n.id === hoveredNodeId);
          if (!node) return null;
          return (
            <div style={{
              ...styles.tooltip,
              left: mousePos.x + 15,
              top: mousePos.y + 15,
              borderColor: NODE_COLORS[node.type]
            }}>
              <div style={{ color: NODE_COLORS[node.type], fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
                {node.type}
              </div>
              <div style={{ marginTop: '4px', fontSize: '12px' }}>
                {node.content.substring(0, 100)}{node.content.length > 100 ? '...' : ''}
              </div>
            </div>
          );
        })()}

      </div>

      {/* Sidebar for Node Details */}
      {selectedNodeData && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={{ 
              backgroundColor: NODE_COLORS[selectedNodeData.type] + '33', 
              color: NODE_COLORS[selectedNodeData.type],
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              textTransform: 'uppercase',
              border: `1px solid ${NODE_COLORS[selectedNodeData.type]}`
            }}>
              {selectedNodeData.type}
            </span>
            <button style={styles.iconButton} onClick={() => setSelectedNodeId(null)}>×</button>
          </div>
          
          <div style={styles.sidebarContent}>
            <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '16px' }}>
              {new Date(selectedNodeData.timestamp).toLocaleString()}
            </div>
            
            <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginBottom: '24px' }}>
              {selectedNodeData.content}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {selectedNodeData.tags?.map(t => (
                <span key={t} style={styles.tag}>#{t}</span>
              ))}
            </div>
            
            <div style={{ fontSize: '12px', color: '#888', borderTop: '1px solid #333', paddingTop: '12px' }}>
              Connections: {selectedNodeData.connectionsCount || 0}<br/>
              Importance: {selectedNodeData.importance.toFixed(2)}
            </div>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button style={styles.dangerButton} onClick={() => {
                setData(prev => ({
                  nodes: prev.nodes.filter(n => n.id !== selectedNodeId),
                  edges: prev.edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId)
                }));
                setSelectedNodeId(null);
              }}>
                Remove Node
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimap */}
      <div style={styles.minimapContainer}>
        <canvas ref={minimapRef} width={150} height={120} style={{ display: 'block', background: '#0a0a0f', borderRadius: '4px' }} />
      </div>

      {/* Add Node Modal */}
      {isAddingNode && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ marginTop: 0, color: '#fff' }}>Add Memory Node</h3>
            <form onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select name="type" required style={styles.input}>
                <option value="concept">Concept</option>
                <option value="event">Event</option>
                <option value="person">Person</option>
                <option value="tool">Tool</option>
                <option value="code">Code</option>
                <option value="design">Design</option>
              </select>
              <textarea 
                name="content" 
                required 
                placeholder="Content..." 
                rows={5} 
                style={{ ...styles.input, resize: 'vertical' }}
              />
              <input 
                type="text" 
                name="tags" 
                placeholder="Tags (comma separated)" 
                style={styles.input}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsAddingNode(false)} style={{ ...styles.button, background: 'transparent' }}>Cancel</button>
                <button type="submit" style={styles.primaryButton}>Add Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#00e5ff', fontFamily: 'monospace' }}>
          INITIALIZING KNOWLEDGE MATRIX...
        </div>
      )}
    </div>
  );
}

// --- Inline Styles ---
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#050508',
    color: '#e0e0e0',
    fontFamily: '"Consolas", "Courier New", monospace',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9999,
  },
  topBar: {
    height: '48px',
    borderBottom: '1px solid #1a1a24',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    backgroundColor: '#0a0a0f',
  },
  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    color: '#00e5ff',
    fontWeight: 'bold',
    letterSpacing: '1px',
    fontSize: '14px',
  },
  stats: {
    color: '#555566',
    fontSize: '12px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  input: {
    backgroundColor: '#111118',
    border: '1px solid #333344',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '12px',
    outline: 'none',
  },
  select: {
    backgroundColor: '#111118',
    border: '1px solid #333344',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '12px',
    cursor: 'pointer',
  },
  button: {
    backgroundColor: '#222233',
    border: '1px solid #444455',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    backgroundColor: '#00e5ff',
    border: 'none',
    color: '#000',
    padding: '6px 16px',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  dangerButton: {
    backgroundColor: 'transparent',
    border: '1px solid #ff0066',
    color: '#ff0066',
    padding: '6px 12px',
    borderRadius: '4px',
    fontFamily: 'inherit',
    fontSize: '12px',
    cursor: 'pointer',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#ff0066',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  sidebar: {
    position: 'absolute',
    right: '0',
    top: '48px',
    bottom: '0',
    width: '320px',
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
    borderLeft: '1px solid #1a1a24',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-5px 0 20px rgba(0,0,0,0.5)',
  },
  sidebarHeader: {
    padding: '16px',
    borderBottom: '1px solid #1a1a24',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarContent: {
    padding: '16px',
    overflowY: 'auto',
    flex: 1,
  },
  iconButton: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '16px',
    cursor: 'pointer',
  },
  tag: {
    backgroundColor: '#1a1a24',
    color: '#8888aa',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
  },
  minimapContainer: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    width: '150px',
    height: '120px',
    border: '1px solid #333344',
    borderRadius: '4px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    zIndex: 10, // above canvas, below sidebar if open (will naturally be covered by sidebar due to right:16px vs sidebar width)
  },
  tooltip: {
    position: 'fixed',
    backgroundColor: 'rgba(5, 5, 8, 0.9)',
    border: '1px solid #333',
    padding: '8px 12px',
    borderRadius: '4px',
    pointerEvents: 'none',
    maxWidth: '250px',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: '#0a0a0f',
    border: '1px solid #333344',
    borderRadius: '8px',
    padding: '24px',
    width: '400px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
  }
};
