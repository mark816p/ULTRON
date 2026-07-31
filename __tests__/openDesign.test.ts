import { NexuOpenDesignEngine } from "../lib/openDesign";

describe("NexuOpenDesign Synthesis & Token Engine", () => {
  test("should list design tokens and preset components", () => {
    const design = new NexuOpenDesignEngine();
    const tokens = design.getTokens();
    expect(tokens.length).toBeGreaterThan(0);

    const components = design.getComponents();
    expect(components.length).toBeGreaterThan(0);
  });

  test("should generate new UI component dynamically", () => {
    const design = new NexuOpenDesignEngine();
    const comp = design.generateDesignComponent("Neon Sidebar Drawer", "Translucent glass drawer for navigation", "drawer");
    expect(comp.name).toBe("Neon Sidebar Drawer");
    expect(comp.category).toBe("drawer");
    expect(comp.jsxCode).toContain("drawer");

    const list = design.getComponents();
    expect(list.some(c => c.id === comp.id)).toBe(true);
  });
});
