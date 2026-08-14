import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");

let badgeForState;
let defaults;
let normalizeSettings;
let storageMigration;

beforeAll(() => {
  const dom = new JSDOM("<!doctype html><html></html>", {
    runScripts: "outside-only",
  });
  dom.window.eval(
    readFileSync(path.join(repoRoot, "umbra-extension/defaults.js"), "utf8"),
  );
  badgeForState = dom.window.UMBRA_BADGE_FOR_STATE;
  defaults = dom.window.UMBRA_DEFAULTS;
  normalizeSettings = dom.window.UMBRA_NORMALIZE_SETTINGS;
  storageMigration = dom.window.UMBRA_STORAGE_MIGRATION;
});

describe("visual defaults", () => {
  it("uses strong surrounding suppression by default", () => {
    expect(defaults.overlayOpacity).toBe(0.74);
  });

  it("upgrades the previous default without replacing a custom value", () => {
    expect(storageMigration({ overlayOpacity: 0.52 }).set).toMatchObject({
      overlayOpacity: 0.74,
      visualDefaultsVersion: 1,
    });
    expect(
      storageMigration({ overlayOpacity: 0.67 }).set.overlayOpacity,
    ).toBeUndefined();
    expect(normalizeSettings({ overlayOpacity: 0.52 }).overlayOpacity).toBe(
      0.74,
    );
    expect(
      normalizeSettings({
        overlayOpacity: 0.52,
        visualDefaultsVersion: 1,
      }).overlayOpacity,
    ).toBe(0.52);
  });

  it("removes superseded focus timing keys", () => {
    const migration = storageMigration({
      behaviorDefaultsVersion: 1,
      pointerPriorityMs: 220,
      refocusCooldownMs: 5000,
    });

    expect(migration.remove).toEqual(
      expect.arrayContaining(["pointerPriorityMs", "refocusCooldownMs"]),
    );
  });

  it("preserves customized behavior through repeated normalization", () => {
    const customized = normalizeSettings({
      behaviorDefaultsVersion: 1,
      dwellMs: 1350,
      refocusDwellMs: 2100,
      pointerQuietMs: 360,
    });
    const normalizedAgain = normalizeSettings(customized);

    expect(normalizedAgain).toMatchObject({
      behaviorDefaultsVersion: 1,
      dwellMs: 1350,
      refocusDwellMs: 2100,
      pointerQuietMs: 360,
    });
  });
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
