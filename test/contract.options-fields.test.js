import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionRoot = path.join(repoRoot, "umbra-extension");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function parseFields(source) {
  const match = source.match(/const\s+FIELDS\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error("FIELDS declaration not found");
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

function parseFormControlIds(html) {
  return [
    ...html.matchAll(/<(?:input|textarea|select)\b[^>]*\bid=["']([^"']+)["']/g),
  ].map((item) => item[1]);
}

function assertEngineReads(keys, contentSource) {
  const missing = keys.filter((key) => {
    const dotRead = new RegExp(`state\\.settings\\.${key}\\b`);
    const bracketRead = new RegExp(`state\\.settings\\[['"]${key}['"]\\]`);
    return !dotRead.test(contentSource) && !bracketRead.test(contentSource);
  });
  if (missing.length) {
    throw new Error(
      `Settings controls not read by engine: ${missing.join(", ")}`,
    );
  }
}

describe("settings contract", () => {
  const contentSource = read("umbra-extension/content.js");
  const optionsSource = read("umbra-extension/options.js");
  const optionsHtml = read("umbra-extension/options.html");
  const popupHtml = read("umbra-extension/popup.html");
  const defaultsSource = read("umbra-extension/defaults.js");

  it("has one authoritative defaults declaration", () => {
    const declarationPattern = new RegExp(
      ["const", "DEFAULTS"].join("\\s+"),
      "g",
    );
    const sources = [
      defaultsSource,
      contentSource,
      read("umbra-extension/background.js"),
      optionsSource,
      read("umbra-extension/popup.js"),
    ].join("\n");

    expect(sources.match(declarationPattern)).toHaveLength(1);
  });

  it("keeps options form controls aligned with persisted settings fields", () => {
    const fields = parseFields(optionsSource);
    const controls = parseFormControlIds(optionsHtml).sort();

    expect(controls).toEqual([...fields, "siteOverrides"].sort());
    assertEngineReads([...fields, "siteOverrides"], contentSource);
  });

  it("keeps popup settings controls backed by engine reads", () => {
    const popupSettingMap = {
      enabledToggle: "enabled",
      siteModeAuto: "siteOverrides",
      siteModeManual: "siteOverrides",
      siteModeOff: "siteOverrides",
    };

    for (const id of Object.keys(popupSettingMap)) {
      expect(popupHtml).toContain(`id="${id}"`);
    }
    assertEngineReads(Object.values(popupSettingMap), contentSource);
  });

  it("fails if a settings control is not consumed by the engine", () => {
    expect(() => assertEngineReads(["fictionSetting"], contentSource)).toThrow(
      /fictionSetting/,
    );
  });

  it("loads defaults before every classic settings consumer", () => {
    const manifest = JSON.parse(read("umbra-extension/manifest.json"));
    const scripts = manifest.content_scripts[0].js;
    expect(scripts.indexOf("defaults.js")).toBeLessThan(
      scripts.indexOf("content.js"),
    );
    expect(optionsHtml.indexOf("defaults.js")).toBeLessThan(
      optionsHtml.indexOf("options.js"),
    );
    expect(popupHtml.indexOf("defaults.js")).toBeLessThan(
      popupHtml.indexOf("popup.js"),
    );
  });

  it("does not leave dead visual setting controls in the package", () => {
    const packageText = [
      read("README.md"),
      ...[
        "background.js",
        "content.js",
        "options.html",
        "options.js",
        "popup.html",
        "popup.js",
      ].map((file) => read(path.join("umbra-extension", file))),
    ].join("\n");
    const removedSettingPattern = new RegExp(
      [`blur${"Px"}`, `center${"Bias"}`].join("|"),
    );
    expect(packageText).not.toMatch(removedSettingPattern);
  });

  it("checks the expected extension root", () => {
    expect(extensionRoot.endsWith("umbra-extension")).toBe(true);
  });
});
