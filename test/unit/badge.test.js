import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");

let badgeForState;

beforeAll(() => {
  const dom = new JSDOM("<!doctype html><html></html>", {
    runScripts: "outside-only",
  });
  dom.window.eval(
    readFileSync(path.join(repoRoot, "umbra-extension/defaults.js"), "utf8"),
  );
  badgeForState = dom.window.UMBRA_BADGE_FOR_STATE;
});

describe("badgeForState", () => {
  it("shows no badge for an active auto site", () => {
    expect(
      badgeForState({
        siteMode: "auto",
        pausedForTab: false,
        autoBlockedReason: null,
      }),
    ).toEqual({ text: "", color: "#5b8def" });
  });

  it("flags the disabled, paused, off, and manual states", () => {
    expect(badgeForState({ autoBlockedReason: "disabled" }).text).toBe("OFF");
    expect(badgeForState({ pausedForTab: true }).text).toBe("II");
    expect(badgeForState({ siteMode: "off" }).text).toBe("OFF");
    expect(badgeForState({ siteMode: "manual" }).text).toBe("M");
  });

  it("prioritizes paused over the resolved site mode", () => {
    expect(badgeForState({ pausedForTab: true, siteMode: "manual" }).text).toBe(
      "II",
    );
  });

  it("is safe when no state is available", () => {
    expect(badgeForState(null)).toEqual({ text: "", color: "#5b8def" });
  });
});
