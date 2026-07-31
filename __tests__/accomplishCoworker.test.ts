import { AccomplishCoworkerEngine } from "../lib/accomplishCoworker";

describe("Accomplish AI Coworker Autonomous Task Engine", () => {
  test("should initialize with sample tasks", () => {
    const coworker = new AccomplishCoworkerEngine();
    const tasks = coworker.getTasks();
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].title).toContain("Autonomous System Audit");
  });

  test("should create and execute autonomous coworker task", async () => {
    const coworker = new AccomplishCoworkerEngine();
    const task = await coworker.createAndRunTask("Test Mission", "Run multi-step autonomous test task");
    expect(task.status).toBe("completed");
    expect(task.steps.length).toBeGreaterThan(0);
    expect(task.artifacts.length).toBeGreaterThan(0);
  });
});
