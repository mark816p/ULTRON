import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * OrbScene API Interface
 * Defines the contract for interacting with the 3D orb visualization.
 */
export interface OrbSceneApi {
  /**
   * Updates the visual state of the orb to reflect the current AI state.
   * This drives the target color of the network which smoothly interpolates over time.
   */
  setAIState: (state: 'idle' | 'thinking' | 'speaking' | 'pondering' | 'error') => void;
  
  /**
   * Displays transient thought words floating near the main hub nodes.
   * The words will fade out after a designated time (e.g., 5 seconds).
   */
  setThoughtWords: (words: string[]) => void;
  
  /**
   * Adjusts the perceived depth or camera distance based on a normalized factor.
   */
  setDepthFactor: (factor: number) => void;

  /** Rotate the orb by delta theta and phi (gesture control) */
  rotateBy?: (dTheta: number, dPhi: number) => void;

  /** Zoom by a scale factor (gesture control) */
  zoomBy?: (factor: number) => void;

  /** Zoom in one step */
  zoomIn?: () => void;

  /** Zoom out one step */
  zoomOut?: () => void;

  /** Reset camera view to default position */
  resetView?: () => void;

  /**
   * Cleans up all Three.js resources (geometries, materials, textures, renderer)
   * and unbinds all attached event listeners to prevent memory leaks.
   */
  dispose: () => void;
}


/**
 * Initializes and mounts the complete 3D Node Network Orb Scene.
 * @param container The DOM element where the Three.js canvas will be injected.
 * @returns An OrbSceneApi instance to interact with the running visualization.
 */
export function createOrbScene(container: HTMLElement): OrbSceneApi {
  // ==========================================
  // 1. CORE THREE.JS SETUP
  // ==========================================
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  const scene = new THREE.Scene();
  // Deep space background color
  scene.background = new THREE.Color(0x020204);
  // Subtle exponential fog to blend distant elements
  scene.fog = new THREE.FogExp2(0x020204, 0.015);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  // Cap pixel ratio at 2 for performance on high-DPI displays
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // ==========================================
  // 2. POST PROCESSING PIPELINE
  // ==========================================
  
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  
  // Bloom adds the glowing effect to bright materials
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    1.2, // strength
    0.5, // radius
    0.1  // threshold
  );
  composer.addPass(bloomPass);

  // ==========================================
  // 3. COLOR STATE MANAGEMENT
  // ==========================================
  
  const stateColors = {
    idle: new THREE.Color(0x0066ff),      // Blue
    thinking: new THREE.Color(0xff8800),  // Amber
    speaking: new THREE.Color(0x00ff88),  // Green
    pondering: new THREE.Color(0x9900ff), // Purple
    error: new THREE.Color(0xff2200)      // Red
  };
  
  const currentColor = new THREE.Color(stateColors.idle);
  const targetColor = new THREE.Color(stateColors.idle);
  
  // A master group to hold the network elements so they can be rotated together
  const networkGroup = new THREE.Group();
  scene.add(networkGroup);

  // ==========================================
  // 4. NODE NETWORK GENERATION
  // ==========================================
  
  const numNodes = 200;
  const numHubs = 20;
  const totalNodes = numNodes + numHubs;
  const radius = 6.0;
  
  const nodesPos: THREE.Vector3[] = [];
  const positions = new Float32Array(totalNodes * 3);
  const sizes = new Float32Array(totalNodes);
  const phases = new Float32Array(totalNodes);
  const isHubAttr = new Float32Array(totalNodes);
  
  // Determine which nodes act as large, bright "hubs"
  const allIndices = Array.from({ length: totalNodes }, (_, i) => i);
  // Fisher-Yates shuffle to randomly select hub nodes
  for (let i = allIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
  }
  const hubIndices = allIndices.slice(0, numHubs);

  // Distribute nodes evenly across the sphere using the Golden Spiral method
  for (let i = 0; i < totalNodes; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / totalNodes);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);
    
    const pos = new THREE.Vector3(x, y, z);
    nodesPos.push(pos);
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    // Random phase offset for asynchronous pulsing
    phases[i] = Math.random() * Math.PI * 2;
    
    if (hubIndices.includes(i)) {
      sizes[i] = 0.15; // Hubs are larger
      isHubAttr[i] = 1.0;
    } else {
      sizes[i] = 0.08; // Regular nodes are smaller
      isHubAttr[i] = 0.0;
    }
  }

  const nodesGeo = new THREE.BufferGeometry();
  nodesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  nodesGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  nodesGeo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  nodesGeo.setAttribute('isHub', new THREE.BufferAttribute(isHubAttr, 1));

  // Normalized Device Coordinates for the mouse (used in the shader for proximity glow)
  const mouseNDC = new THREE.Vector2(-999, -999);

  // Custom Shader Material to handle dynamic pulsing and screen-space mouse proximity
  const nodesMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: currentColor },
      mousePos: { value: mouseNDC }
    },
    vertexShader: `
      uniform float time;
      uniform vec3 color;
      uniform vec2 mousePos;
      
      attribute float size;
      attribute float phase;
      attribute float isHub;
      
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec4 p = projectionMatrix * mvPosition;
        
        // Calculate screen-space distance to mouse for hover effect
        vec2 ndc = p.xy / p.w;
        float dist = distance(ndc, mousePos);
        float hover = 1.0 - smoothstep(0.0, 0.15, dist);
        
        // Sine wave pulse offset by random phase
        float pulse = sin(time * 2.0 + phase) * 0.5 + 0.5;
        float baseIntensity = isHub > 0.5 ? 1.5 : 0.6;
        
        // Hovering brightens the node towards white
        vColor = color + hover * vec3(0.8);
        vAlpha = (0.2 + pulse * 0.8) * baseIntensity + hover;
        
        // Scale dynamically based on distance, hover, and pulse
        float dynamicSize = size * (1.0 + hover * 1.5 + (isHub > 0.5 ? pulse * 0.5 : 0.0));
        gl_PointSize = dynamicSize * (300.0 / -mvPosition.z);
        gl_Position = p;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        // Create a soft circular point
        vec2 xy = gl_PointCoord.xy - vec2(0.5);
        float ll = length(xy);
        if(ll > 0.5) discard;
        float intensity = smoothstep(0.5, 0.1, ll);
        gl_FragColor = vec4(vColor * intensity, vAlpha * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const nodesMesh = new THREE.Points(nodesGeo, nodesMat);
  networkGroup.add(nodesMesh);

  // ==========================================
  // 5. EDGES (LINE CONNECTIONS)
  // ==========================================
  
  const edgesData: [number, number][] = [];
  const edgesPosArray: number[] = [];
  
  // Connect nearby nodes if distance is less than 2.5
  for (let i = 0; i < totalNodes; i++) {
    for (let j = i + 1; j < totalNodes; j++) {
      if (nodesPos[i].distanceTo(nodesPos[j]) < 2.5) {
        edgesData.push([i, j]);
        edgesPosArray.push(nodesPos[i].x, nodesPos[i].y, nodesPos[i].z);
        edgesPosArray.push(nodesPos[j].x, nodesPos[j].y, nodesPos[j].z);
      }
    }
  }
  
  const edgesGeo = new THREE.BufferGeometry();
  edgesGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgesPosArray, 3));
  
  const edgesMat = new THREE.LineBasicMaterial({
    color: currentColor,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
  networkGroup.add(edgesMesh);

  // ==========================================
  // 6. PARTICLE TRAILS ALONG EDGES
  // ==========================================
  
  const trailCount = 100;
  const trailsInfo: { startIdx: number, endIdx: number, t: number }[] = [];
  const trailPosArray = new Float32Array(trailCount * 3);
  
  // Initialize particles on random edges with random progression 't'
  for (let i = 0; i < trailCount; i++) {
    const e = edgesData[Math.floor(Math.random() * edgesData.length)];
    trailsInfo.push({
      startIdx: e[0],
      endIdx: e[1],
      t: Math.random()
    });
  }
  
  const trailsGeo = new THREE.BufferGeometry();
  trailsGeo.setAttribute('position', new THREE.BufferAttribute(trailPosArray, 3));
  
  const trailsMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  const trailsMesh = new THREE.Points(trailsGeo, trailsMat);
  networkGroup.add(trailsMesh);

  // ==========================================
  // 7. ORBITAL RINGS
  // ==========================================
  
  const ringsGroup = new THREE.Group();
  scene.add(ringsGroup);
  
  // Rings of varying radii and thicknesses
  const ringConfigs = [
    { r: 7.5, tube: 0.02, speed: 0.001 },
    { r: 8.2, tube: 0.03, speed: -0.0015 },
    { r: 9.0, tube: 0.04, speed: 0.0008 }
  ];
  
  const rings: { mesh: THREE.Mesh, speed: number }[] = [];
  
  ringConfigs.forEach(cfg => {
    const geo = new THREE.TorusGeometry(cfg.r, cfg.tube, 16, 100);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff8c00, // Amber / Orange
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.random() * Math.PI;
    mesh.rotation.y = Math.random() * Math.PI;
    ringsGroup.add(mesh);
    rings.push({ mesh, speed: cfg.speed });
  });

  // ==========================================
  // 8. STARFIELD BACKGROUND
  // ==========================================
  
  const starCount = 1500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // Generate uniform random points on a sphere
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 50 + Math.random() * 20; // Spread out distantly
    
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.04,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ==========================================
  // 9. THOUGHT WORDS SPRITES
  // ==========================================
  
  /**
   * Helper class to manage a floating text sprite rendered via 2D Canvas.
   */
  class ThoughtSprite {
    sprite: THREE.Sprite;
    active: boolean = false;
    createdAt: number = 0;
    hubIndex: number = -1;
    
    constructor() {
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthTest: false,
        blending: THREE.AdditiveBlending
      });
      this.sprite = new THREE.Sprite(mat);
      this.sprite.scale.set(4, 1, 1);
    }
    
    setText(text: string) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 512, 128);
      
      ctx.font = 'bold 48px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 150, 255, 0.8)';
      ctx.shadowBlur = 10;
      ctx.fillText(text, 256, 64);
      
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      
      if (this.sprite.material.map) {
        this.sprite.material.map.dispose();
      }
      this.sprite.material.map = tex;
      this.sprite.material.needsUpdate = true;
    }
  }

  // Pre-allocate a pool of up to 8 active thought words
  const thoughts: ThoughtSprite[] = [];
  for (let i = 0; i < 8; i++) {
    const ts = new ThoughtSprite();
    scene.add(ts.sprite);
    thoughts.push(ts);
  }
  let nextThoughtIdx = 0;

  // ==========================================
  // 10. CUSTOM CAMERA CONTROLS & INTERACTION
  // ==========================================
  
  let camTheta = 0;
  let camPhi = Math.PI / 2;
  let camRadius = 18;
  
  let isDragging = false;
  const previousMouse = { x: 0, y: 0 };
  
  const updateCamera = () => {
    // Convert spherical coordinates to Cartesian for the camera
    camera.position.x = camRadius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.y = camRadius * Math.cos(camPhi);
    camera.position.z = camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    camera.lookAt(0, 0, 0);
  };
  updateCamera();

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    previousMouse.x = e.clientX;
    previousMouse.y = e.clientY;
  };
  
  const onMouseMove = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    // Update NDC for hover brightening effect
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (isDragging) {
      const dx = e.clientX - previousMouse.x;
      const dy = e.clientY - previousMouse.y;
      camTheta -= dx * 0.005;
      camPhi -= dy * 0.005;
      
      // Clamp polar angle to avoid flipping at the poles
      camPhi = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi));
      
      previousMouse.x = e.clientX;
      previousMouse.y = e.clientY;
      updateCamera();
    }
  };
  
  const onMouseUp = () => {
    isDragging = false;
  };
  
  const onMouseLeave = () => {
    isDragging = false;
    mouseNDC.set(-999, -999);
  };
  
  const onWheel = (e: WheelEvent) => {
    camRadius += e.deltaY * 0.02;
    camRadius = Math.max(10, Math.min(25, camRadius));
    updateCamera();
  };
  
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  };

  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  container.addEventListener('mouseleave', onMouseLeave);
  container.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('resize', onResize);

  // ==========================================
  // 11. ANIMATION LOOP
  // ==========================================
  
  const clock = new THREE.Clock();
  let animationId: number;

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    // Smooth, constant auto-rotation when user is not manually dragging
    if (!isDragging) {
      camTheta -= 0.001;
      updateCamera();
    }
    
    // Rotate the entire network structural group slowly
    networkGroup.rotation.y += 0.003;
    networkGroup.rotation.x += 0.001;
    
    // Rotate external decorative rings independently
    rings.forEach(r => {
      r.mesh.rotation.x += r.speed;
      r.mesh.rotation.y += r.speed * 1.5;
    });
    
    // Interpolate current color towards the target AI state color
    currentColor.lerp(targetColor, 0.05);
    edgesMat.color.copy(currentColor);
    
    // Pass time uniform to shader for node pulsing
    nodesMat.uniforms.time.value = time;
    
    // Update traveling particle trails along edges
    for (let i = 0; i < trailCount; i++) {
      trailsInfo[i].t += 0.008; // advance progress
      
      // If particle reaches the end, reset and pick a new random edge
      if (trailsInfo[i].t >= 1.0) {
        trailsInfo[i].t = 0;
        const e = edgesData[Math.floor(Math.random() * edgesData.length)];
        trailsInfo[i].startIdx = e[0];
        trailsInfo[i].endIdx = e[1];
      }
      
      const p1 = nodesPos[trailsInfo[i].startIdx];
      const p2 = nodesPos[trailsInfo[i].endIdx];
      
      // Interpolate position along the edge
      trailPosArray[i * 3] = p1.x + (p2.x - p1.x) * trailsInfo[i].t;
      trailPosArray[i * 3 + 1] = p1.y + (p2.y - p1.y) * trailsInfo[i].t;
      trailPosArray[i * 3 + 2] = p1.z + (p2.z - p1.z) * trailsInfo[i].t;
    }
    trailsGeo.attributes.position.needsUpdate = true;
    
    // Manage thought words lifecycle and animation
    const now = performance.now();
    thoughts.forEach(ts => {
      if (ts.active) {
        const age = (now - ts.createdAt) / 1000; // time alive in seconds
        
        // Deactivate after 5 seconds
        if (age > 5.0) {
          ts.active = false;
          ts.sprite.material.opacity = 0;
        } else {
          // Fade in for the first 0.5s, fade out for the last 1s
          let alpha = 1.0;
          if (age < 0.5) alpha = age / 0.5;
          else if (age > 4.0) alpha = 1.0 - (age - 4.0);
          
          ts.sprite.material.opacity = alpha;
          
          // Hover slightly above its designated hub node
          if (ts.hubIndex >= 0) {
            const hubPos = nodesPos[ts.hubIndex].clone();
            // Apply network rotation to track the moving hub correctly in world space
            hubPos.applyMatrix4(networkGroup.matrixWorld);
            // Slowly drift upwards over its lifetime
            hubPos.y += age * 0.3 + 0.5;
            ts.sprite.position.copy(hubPos);
          }
        }
      }
    });

    composer.render();
  };
  
  // Kick off the animation
  animate();

  // ==========================================
  // 12. PUBLIC API RETURN
  // ==========================================
  
  return {
    setAIState: (state) => {
      if (stateColors[state]) {
        targetColor.copy(stateColors[state]);
      }
    },
    
    setThoughtWords: (words) => {
      if (!words || words.length === 0) return;
      words.forEach(word => {
        const ts = thoughts[nextThoughtIdx];
        ts.setText(word);
        ts.active = true;
        ts.createdAt = performance.now();
        // Bind this thought to a random hub node
        ts.hubIndex = hubIndices[Math.floor(Math.random() * hubIndices.length)];
        nextThoughtIdx = (nextThoughtIdx + 1) % thoughts.length;
      });
    },
    
    setDepthFactor: (factor) => {
      // Map depth factor (0 to 1) to a slight camera radius adjustment
      camRadius = 18 - factor * 5;
      camRadius = Math.max(10, Math.min(25, camRadius));
      updateCamera();
    },

    rotateBy: (dTheta: number, dPhi: number) => {
      camTheta += dTheta;
      camPhi = Math.max(0.1, Math.min(Math.PI - 0.1, camPhi + dPhi));
      updateCamera();
    },

    zoomBy: (factor: number) => {
      camRadius = Math.max(10, Math.min(30, camRadius * factor));
      updateCamera();
    },

    zoomIn: () => {
      camRadius = Math.max(10, camRadius - 1.5);
      updateCamera();
    },

    zoomOut: () => {
      camRadius = Math.min(30, camRadius + 1.5);
      updateCamera();
    },

    resetView: () => {
      camRadius = 18;
      camTheta = 0;
      camPhi = Math.PI / 2;
      updateCamera();
    },
    
    dispose: () => {
      // 1. Stop animation loop
      cancelAnimationFrame(animationId);
      
      // 2. Remove all event listeners
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      
      // 3. Clean up generic geometries and materials
      nodesGeo.dispose();
      nodesMat.dispose();
      edgesGeo.dispose();
      edgesMat.dispose();
      trailsGeo.dispose();
      trailsMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      
      // 4. Clean up procedural meshes (Rings)
      rings.forEach(r => {
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
      });
      
      // 5. Clean up Sprite materials and textures
      thoughts.forEach(ts => {
        if (ts.sprite.material.map) ts.sprite.material.map.dispose();
        ts.sprite.material.dispose();
      });
      
      // 6. Dispose of renderer and post-processing composer
      composer.dispose();
      renderer.dispose();
      
      // 7. Remove the WebGL canvas from the DOM
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
