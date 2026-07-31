import { FREE_LLM_RESOURCES } from "../lib/freeLlmResources";

describe("Free LLM Resource Registry", () => {
  test("should contain valid non-empty LLM resources", () => {
    expect(FREE_LLM_RESOURCES.length).toBeGreaterThan(0);
  });

  test("every resource must have required fields", () => {
    for (const res of FREE_LLM_RESOURCES) {
      expect(res.id).toBeTruthy();
      expect(res.name).toBeTruthy();
      expect(res.provider).toBeTruthy();
      expect(res.model).toBeTruthy();
      expect(res.baseUrl).toMatch(/^https?:\/\//);
    }
  });

  test("should include Google Gemini 2.0 Flash as free tier resource", () => {
    const gemini = FREE_LLM_RESOURCES.find(r => r.id === "gemini-free-flash");
    expect(gemini).toBeDefined();
    expect(gemini?.provider).toBe("Google AI");
  });
});
