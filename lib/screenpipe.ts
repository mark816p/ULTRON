export interface ScreenFrameRecord {
  id: string;
  timestamp: number;
  appName: string;
  windowTitle: string;
  ocrText: string;
  audioTranscript?: string;
  tags: string[];
}

export class ScreenpipeEngine {
  private isCapturing: boolean = true;
  private history: ScreenFrameRecord[] = [];
  private maxHistoryLength: number = 300;

  constructor() {
    this.initMockContext();
  }

  private initMockContext() {
    const now = Date.now();
    this.history = [
      {
        id: "frame_1",
        timestamp: now - 180000,
        appName: "Visual Studio Code",
        windowTitle: "d:\\AI Creations\\Ultron\\lib\\omniRoute.ts - ULTRON",
        ocrText: "export class OmniRouteEngine { private router: AiRouter; ... }",
        audioTranscript: "Jarvis check the multi-provider failover router telemetry",
        tags: ["code", "ide", "development"],
      },
      {
        id: "frame_2",
        timestamp: now - 90000,
        appName: "Google Chrome",
        windowTitle: "GitHub - open-jarvis/OpenJarvis & screenpipe/screenpipe",
        ocrText: "OpenJarvis: Autonomous personal AI assistant agent. Screenpipe: 24/7 continuous local screen & audio capture.",
        audioTranscript: "Jarvis integrate OpenJarvis and Screenpipe",
        tags: ["browser", "github", "research"],
      },
      {
        id: "frame_3",
        timestamp: now - 15000,
        appName: "ULTRON Desktop Client",
        windowTitle: "U.L.T.R.O.N. v9.4.5 Sentient Holographic AI Orb",
        ocrText: "U.L.T.R.O.N. v9.4.5 OpenJarvis, Screenpipe, Fish Voices, OmniRoute & MCP active",
        audioTranscript: "Jarvis analyze my screen and open the browser",
        tags: ["ultron", "system", "active"],
      },
    ];
  }

  public async captureCurrentFrame(windowTitle?: string, appName?: string, ocrText?: string): Promise<ScreenFrameRecord> {
    const record: ScreenFrameRecord = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      appName: appName || "Desktop Workstation",
      windowTitle: windowTitle || "Active Workspace",
      ocrText: ocrText || "ULTRON Autonomous Operating Network v9.4.5",
      tags: ["active_context"],
    };

    this.history.push(record);
    if (this.history.length > this.maxHistoryLength) {
      this.history = this.history.slice(-this.maxHistoryLength);
    }
    return record;
  }

  public searchHistory(query: string, limit = 20): ScreenFrameRecord[] {
    if (!query || !query.trim()) return this.history.slice(-limit);
    const q = query.toLowerCase();
    return this.history
      .filter(
        (r) =>
          r.appName.toLowerCase().includes(q) ||
          r.windowTitle.toLowerCase().includes(q) ||
          r.ocrText.toLowerCase().includes(q) ||
          (r.audioTranscript && r.audioTranscript.toLowerCase().includes(q))
      )
      .slice(-limit);
  }

  public getLatestScreenContext(): string {
    const latest = this.history[this.history.length - 1];
    if (!latest) return "Screenpipe: No active screen capture frame.";
    return `[Screenpipe 24/7 Context]: App="${latest.appName}", Title="${latest.windowTitle}", OCR="${latest.ocrText.slice(0, 150)}..."${latest.audioTranscript ? `, Audio="${latest.audioTranscript}"` : ""}`;
  }

  public getHistory(): ScreenFrameRecord[] {
    return this.history;
  }

  public setCapturing(enabled: boolean) {
    this.isCapturing = enabled;
  }

  public isCaptureEnabled(): boolean {
    return this.isCapturing;
  }
}

export const screenpipeEngine = new ScreenpipeEngine();
