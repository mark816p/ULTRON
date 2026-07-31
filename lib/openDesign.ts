export interface DesignToken {
  category: "colors" | "typography" | "glassmorphism" | "animations";
  name: string;
  value: string;
  cssVariable: string;
}

export interface GeneratedUiComponent {
  id: string;
  name: string;
  description: string;
  category: "hero" | "card" | "drawer" | "hud_element" | "modal";
  jsxCode: string;
  cssCode: string;
  previewUrl?: string;
  createdAt: number;
}

export class NexuOpenDesignEngine {
  private designTokens: DesignToken[] = [
    { category: "colors", name: "Holographic Cyan", value: "#38bdf8", cssVariable: "--color-cyan" },
    { category: "colors", name: "Deep Void", value: "#030308", cssVariable: "--color-void" },
    { category: "glassmorphism", name: "Liquid Glass Backdrop", value: "backdrop-filter: blur(20px)", cssVariable: "--glass-blur" },
    { category: "animations", name: "Pulse Glow", value: "0 0 25px rgba(56, 189, 248, 0.4)", cssVariable: "--glow-pulse" },
  ];

  private generatedComponents: GeneratedUiComponent[] = [];

  constructor() {
    this.initPresetComponents();
  }

  private initPresetComponents() {
    this.generatedComponents = [
      {
        id: "comp_1",
        name: "Liquid Glass HUD Card",
        description: "Modern KokonutUI & ReactBits inspired translucent glass card with animated neon border",
        category: "card",
        jsxCode: `<div className="glass-card"><div className="card-header">⚡ NEURAL SPECTRUM</div></div>`,
        cssCode: `.glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border-radius: 16px; }`,
        createdAt: Date.now() - 3600000,
      },
      {
        id: "comp_2",
        name: "Sentient 3D Particle Ring",
        description: "WebGL Three.js reactive icosahedron wireframe shell with bloom post-processing",
        category: "hud_element",
        jsxCode: `<canvas className="orb-canvas" />`,
        cssCode: `.orb-canvas { position: absolute; inset: 0; filter: drop-shadow(0 0 30px #38bdf8); }`,
        createdAt: Date.now() - 1800000,
      },
    ];
  }

  /**
   * Generates a new UI design component based on prompt criteria
   */
  public generateDesignComponent(name: string, description: string, category: GeneratedUiComponent["category"]): GeneratedUiComponent {
    const comp: GeneratedUiComponent = {
      id: "design_" + Math.random().toString(36).substring(2, 9),
      name,
      description,
      category,
      jsxCode: `<div className="open-design-${category}"><h3>${name}</h3><p>${description}</p></div>`,
      cssCode: `.open-design-${category} { background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; padding: 20px; border-radius: 16px; color: #fff; }`,
      createdAt: Date.now(),
    };

    this.generatedComponents.push(comp);
    return comp;
  }

  public getTokens(): DesignToken[] {
    return this.designTokens;
  }

  public getComponents(): GeneratedUiComponent[] {
    return this.generatedComponents;
  }
}

export const openDesignEngine = new NexuOpenDesignEngine();
