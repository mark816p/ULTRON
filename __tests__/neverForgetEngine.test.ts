import { NeverForgetEngine } from "../lib/neverForgetEngine";
import fs from "fs";
import path from "path";

describe("NeverForgetEngine Memory & Persistence System", () => {
  const testDbPath = path.join(__dirname, "test_memory.json");

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  test("should remember messages and calculate token estimates", async () => {
    const engine = new NeverForgetEngine({ dbPath: testDbPath, maxWindowSize: 10 });
    await engine.remember("session-1", "user", "Initialize Ultron v9.6.2 core protocols.");
    await engine.remember("session-1", "assistant", "Ultron online and operating.");

    const search = engine.searchMemories("protocols");
    expect(search.length).toBe(1);
    expect(search[0].content).toContain("v9.6.2");
  });

  test("should deduplicate context with prepareContext", async () => {
    const engine = new NeverForgetEngine({ dbPath: testDbPath });
    await engine.remember("session-2", "user", "Status report");

    const prepared = engine.prepareContext("session-2", "System System", [
      { role: "assistant", content: "All systems nominal" },
      { role: "assistant", content: "All systems nominal" },
    ]);

    expect(prepared.dedupStats.dupsRemoved).toBe(1);
  });

  test("should compact database correctly and return metrics", async () => {
    const engine = new NeverForgetEngine({ dbPath: testDbPath, maxWindowSize: 5 });
    for (let i = 0; i < 10; i++) {
      await engine.remember("session-3", "user", `Turn number ${i}`);
    }

    const stats = engine.compactDatabase();
    expect(stats.totalMemories).toBe(5);
    expect(stats.totalSessions).toBe(1);
  });
});
