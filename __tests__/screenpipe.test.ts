import { ScreenpipeEngine } from "../lib/screenpipe";

describe("Screenpipe continuous 24/7 OCR & Audio Timeline Engine", () => {
  test("should initialize with history records", () => {
    const engine = new ScreenpipeEngine();
    const history = engine.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].appName).toBeDefined();
  });

  test("should search OCR text and audio transcripts", () => {
    const engine = new ScreenpipeEngine();
    const results = engine.searchTimeline("OpenJarvis");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ocrText).toContain("OpenJarvis");
  });

  test("should capture new screen frame record", async () => {
    const engine = new ScreenpipeEngine();
    const record = await engine.captureCurrentFrame("Testing Window", "TestApp", "OCR text sample");
    expect(record.appName).toBe("TestApp");
    expect(record.windowTitle).toBe("Testing Window");
    expect(record.ocrText).toBe("OCR text sample");
  });
});
