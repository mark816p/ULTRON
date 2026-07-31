import { OmniRouteEngine } from "../lib/omniRoute";

describe("OmniRouteEngine Intelligent Key Routing & Telemetry", () => {
  test("should select valid non-cooled key", () => {
    const engine = new OmniRouteEngine();
    const keys = ["key-1", "key-2", "key-3"];
    const selected = engine.selectKey(keys);
    expect(keys).toContain(selected);
  });

  test("should respect key cooldowns", () => {
    const engine = new OmniRouteEngine();
    engine.markKeyCooldown("key-1", 60000);
    const selected = engine.selectKey(["key-1", "key-2"]);
    expect(selected).toBe("key-2");
  });

  test("should record provider telemetry correctly", () => {
    const engine = new OmniRouteEngine();
    engine.recordTelemetry("groq", 120, true);
    const telemetry = engine.getTelemetry();
    expect(telemetry["groq"]).toBeDefined();
    expect(telemetry["groq"].successCount).toBe(1);
    expect(telemetry["groq"].latencyMs).toBe(120);
  });
});
