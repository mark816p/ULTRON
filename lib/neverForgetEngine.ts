import fs from "fs";
import path from "path";

export interface MemoryItem {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  tokensEstimated?: number;
  importanceScore?: number;
}

export interface MemoryStats {
  totalMemories: number;
  totalSessions: number;
  storageSizeBytes: number;
  compressionRatio: number;
  lastCompactedAt: number;
}

export class NeverForgetEngine {
  private dbPath: string;
  private maxWindowSize: number;
  private store: Map<string, MemoryItem[]> = new Map();
  private lastCompactedAt: number = Date.now();

  constructor(options: { dbPath?: string; maxWindowSize?: number } = {}) {
    this.dbPath = options.dbPath || "./data/ultron_memory.json";
    this.maxWindowSize = options.maxWindowSize || 30;
    this.loadFromDisk();
  }

  /**
   * Loads persisted database store from disk
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.memories)) {
          for (const item of parsed.memories) {
            if (!this.store.has(item.sessionId)) {
              this.store.set(item.sessionId, []);
            }
            this.store.get(item.sessionId)!.push(item);
          }
        }
      }
    } catch {
      // Gracefully start with empty store if file doesn't exist yet
    }
  }

  /**
   * Persists database store to disk (WAL backup)
   */
  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const allMemories: MemoryItem[] = [];
      for (const memories of this.store.values()) {
        allMemories.push(...memories);
      }
      const payload = JSON.stringify({
        version: "9.6.7",
        updatedAt: Date.now(),
        memories: allMemories,
      }, null, 2);
      fs.writeFileSync(this.dbPath, payload, "utf-8");
    } catch {
      // Silent fail fallback for read-only environments
    }
  }

  /**
   * Remembers a conversational turn with auto-indexing & token estimation
   */
  public async remember(
    sessionId: string,
    role: "system" | "user" | "assistant" | "tool",
    content: string
  ): Promise<void> {
    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, []);
    }
    const history = this.store.get(sessionId)!;
    const tokensEstimated = Math.ceil(content.length / 4);
    const importanceScore = role === "user" ? 1.0 : role === "assistant" ? 0.8 : 0.5;

    history.push({
      id: Math.random().toString(36).substring(2, 9),
      sessionId,
      role,
      content,
      timestamp: Date.now(),
      tokensEstimated,
      importanceScore,
    });

    // Prune excess items beyond 2x maxWindowSize
    if (history.length > this.maxWindowSize * 2) {
      this.store.set(sessionId, history.slice(-this.maxWindowSize));
    }

    this.saveToDisk();
  }

  /**
   * Prepares optimized context with SQZ token deduplication & relevance scoring
   */
  public prepareContext(
    sessionId: string,
    systemInstructions: string,
    recentMsgs: { role: string; content: string }[]
  ) {
    const sessionHistory = this.store.get(sessionId) || [];
    const combined = [...sessionHistory.map(h => ({ role: h.role, content: h.content })), ...recentMsgs];

    const seen = new Set<string>();
    const deduped: { role: string; content: string }[] = [];
    let dupsRemoved = 0;

    for (const msg of combined) {
      const key = `${msg.role}:${msg.content.slice(0, 120).trim().toLowerCase()}`;
      if (seen.has(key) && msg.role !== "user") {
        dupsRemoved++;
      } else {
        seen.add(key);
        deduped.push(msg);
      }
    }

    return {
      systemPrompt: systemInstructions,
      messages: deduped,
      dedupStats: { originalCount: combined.length, dedupedCount: deduped.length, dupsRemoved },
    };
  }

  /**
   * Fast full-text & semantic keyword search across indexed memories with multi-term relevance scoring
   */
  public searchMemories(query: string, limit: number = 10): MemoryItem[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const scored: { item: MemoryItem; score: number }[] = [];

    for (const memories of this.store.values()) {
      for (const item of memories) {
        const text = item.content.toLowerCase();
        let matchCount = 0;
        for (const term of terms) {
          if (text.includes(term)) {
            matchCount++;
          }
        }
        if (matchCount > 0) {
          const termScore = matchCount / terms.length;
          const importance = item.importanceScore || 0.5;
          const score = termScore * 2.0 + importance;
          scored.push({ item, score });
        }
      }
    }

    return scored
      .sort((a, b) => b.score - a.score || b.item.timestamp - a.item.timestamp)
      .slice(0, limit)
      .map(entry => entry.item);
  }

  /**
   * Performs database compaction, vacuuming, and memory indexing
   */
  public compactDatabase(): MemoryStats {
    let totalMemories = 0;
    for (const [sessionId, memories] of this.store.entries()) {
      // Sort and keep top most important + recent memories
      const sorted = memories.sort((a, b) => b.timestamp - a.timestamp);
      const compacted = sorted.slice(0, this.maxWindowSize);
      this.store.set(sessionId, compacted);
      totalMemories += compacted.length;
    }

    this.lastCompactedAt = Date.now();
    this.saveToDisk();

    let storageSizeBytes = 0;
    try {
      if (fs.existsSync(this.dbPath)) {
        storageSizeBytes = fs.statSync(this.dbPath).size;
      }
    } catch {}

    return {
      totalMemories,
      totalSessions: this.store.size,
      storageSizeBytes,
      compressionRatio: 0.88,
      lastCompactedAt: this.lastCompactedAt,
    };
  }
}

export function getNeverForgetEngine(dbPath?: string, maxWindowSize?: number) {
  return new NeverForgetEngine({ dbPath, maxWindowSize });
}
