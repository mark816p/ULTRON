import { AiRouter } from "../lib/aiRouter";

describe("AiRouter Circuit-Breaker Failover Engine", () => {
  test("should initialize with default options", () => {
    const router = new AiRouter();
    expect(router).toBeDefined();
  });

  test("should handle empty message fallback gracefully", async () => {
    const router = new AiRouter();
    const result = await router.route([], "System prompt");
    expect(result.failoverOccurred).toBeDefined();
    expect(result.engine).toBeDefined();
  });
});
