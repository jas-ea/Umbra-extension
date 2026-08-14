import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const source = readFileSync(
  path.join(repoRoot, "umbra-extension/focus-policy.js"),
  "utf8",
);

function coordinator() {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  return context.UMBRA_CREATE_FOCUS_COORDINATOR();
}

describe("focus coordinator", () => {
  it("requires the full first-focus residence", () => {
    const model = coordinator();
    const surface = {};
    const target = { surface, mode: "read" };

    expect(model.observe(target, { now: 0, delay: 1000 }).action).toBe("wait");
    expect(model.observe(target, { now: 999, delay: 1000 }).action).toBe(
      "wait",
    );
    expect(model.observe(target, { now: 1000, delay: 1000 }).action).toBe(
      "commit",
    );
  });

  it("keeps the incumbent until one challenger completes refocus dwell", () => {
    const model = coordinator();
    const first = { surface: {}, mode: "read" };
    const second = { surface: {}, mode: "read" };
    const third = { surface: {}, mode: "read" };
    model.sync(first, 0);

    expect(model.observe(second, { now: 100, delay: 1450 }).action).toBe(
      "wait",
    );
    expect(model.observe(third, { now: 900, delay: 1450 }).action).toBe("wait");
    expect(model.observe(third, { now: 2349, delay: 1450 }).action).toBe(
      "wait",
    );
    expect(model.snapshot().incumbent.surface).toBe(first.surface);
    expect(model.observe(third, { now: 2350, delay: 1450 }).action).toBe(
      "commit",
    );
  });

  it("suspends without discarding the incumbent", () => {
    const model = coordinator();
    const target = { surface: {}, mode: "scan" };
    model.sync(target, 0);

    expect(model.suspend().action).toBe("suspend");
    expect(model.snapshot().incumbent.surface).toBe(target.surface);
    expect(model.snapshot().challenger).toBeNull();
  });
});
