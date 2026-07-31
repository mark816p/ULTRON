import { OpenJarvisEngine } from "../lib/openJarvis";

describe("OpenJarvis Computer Control & Self-Healing Engine", () => {
  test("should list registered automation rules", () => {
    const jarvis = new OpenJarvisEngine();
    const rules = jarvis.getRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].name).toContain("Active Screen Context");
  });

  test("should execute computer action and return action history", async () => {
    const jarvis = new OpenJarvisEngine();
    const action = await jarvis.executeComputerAction("echo test_jarvis", "Test echo execution");
    expect(action.status).toBe("completed");
    expect(action.result).toContain("test_jarvis");

    const history = jarvis.getActionHistory();
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(action.id);
  });
});
