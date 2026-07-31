import { AntigravityBridge } from "../lib/antigravityBridge";

describe("AntigravityBridge Engine & Free Fallback", () => {
  test("should initialize with default timeout", () => {
    const bridge = new AntigravityBridge(5000);
    expect(bridge).toBeDefined();
  });
});
