import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function rect(left, top, width, height) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return this;
    },
  };
}

function setRect(element, value) {
  element.getBoundingClientRect = () => value;
}

async function loadContent(body = "<main></main>") {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    url: "https://example.com/article",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });

  const listeners = new Set();
  const storage = {};
  dom.window.__UMBRA_TEST_HOOKS__ = true;
  dom.window.chrome = {
    storage: {
      sync: {
        get(_keys, callback) {
          callback({ ...storage });
        },
        set(items, callback = () => {}) {
          Object.assign(storage, items);
          callback();
        },
        remove(keys, callback = () => {}) {
          for (const key of Array.isArray(keys) ? keys : [keys])
            delete storage[key];
          callback();
        },
      },
      onChanged: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        },
      },
    },
    runtime: {
      onMessage: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        },
      },
    },
  };
  dom.window.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
  };
  dom.window.requestAnimationFrame = (callback) =>
    dom.window.setTimeout(callback, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);
  dom.window.document.elementFromPoint = () =>
    dom.window.document.querySelector("article");

  dom.window.eval(read("umbra-extension/defaults.js"));
  dom.window.eval(read("umbra-extension/site-profiles.js"));
  dom.window.eval(read("umbra-extension/content.js"));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return { dom, api: dom.window.UMBRA_TEST_API };
}

describe("content helper behavior", () => {
  it("covers clamp, distance, and host normalization", async () => {
    const { api } = await loadContent();

    expect(api.clamp(12, 0, 10)).toBe(10);
    expect(api.clamp(-2, 0, 10)).toBe(0);
    expect(api.distance(0, 0, 3, 4)).toBe(5);
    expect(api.normalizeHost("www.example.com")).toBe("example.com");
  });

  it("derives page family from consumed intent", async () => {
    const { api } = await loadContent();

    api.state.siteProfile = { intent: "comparative" };
    expect(api.pageFamily()).toBe("compare");
    api.state.siteProfile = { intent: "utility" };
    expect(api.pageFamily()).toBe("act");
    api.state.siteProfile = { intent: "article" };
    expect(api.pageFamily()).toBe("read");
  });

  it("scores repeated sibling patterns", async () => {
    const { dom, api } = await loadContent('<section id="rows"></section>');
    const rows = dom.window.document.getElementById("rows");
    for (let index = 0; index < 5; index += 1) {
      const row = dom.window.document.createElement("div");
      row.textContent = `Row ${index}`;
      setRect(row, rect(20, 20 + index * 42, 500, 36));
      rows.append(row);
    }

    expect(
      api.repeatedSiblingPattern(rows.children[2], rect(20, 104, 500, 36)),
    ).toBeGreaterThan(3);
  });

  it("scores candidates without reading layout-forcing innerText", async () => {
    const { dom, api } = await loadContent(
      '<article id="story" class="story"><p>Readable article text with enough length to score.</p></article>',
    );
    const story = dom.window.document.getElementById("story");
    setRect(story, rect(40, 50, 520, 260));
    Object.defineProperty(story, "innerText", {
      get() {
        throw new Error("innerText should not be read");
      },
    });
    api.state.siteProfile = {
      intent: "article",
      surfaceSelectors: ["article"],
      preferSelectors: ["article"],
      quickSelectors: ["article"],
      rejectSelectors: ["aside"],
      rejectTokens: ["sidebar"],
    };

    expect(
      api.candidateScore(story, { x: 120, y: 120 }, "read"),
    ).toBeGreaterThan(0);
  });

  it("rejects known chrome before expensive candidate measurements", async () => {
    const { dom, api } = await loadContent(
      '<article id="chrome" class="sidebar"></article>',
    );
    const chrome = dom.window.document.getElementById("chrome");
    chrome.getBoundingClientRect = () => {
      throw new Error("rejected nodes should not be measured");
    };
    api.state.siteProfile = {
      intent: "article",
      rejectSelectors: [],
      rejectTokens: ["sidebar"],
    };

    expect(api.candidateScore(chrome, { x: 10, y: 10 }, "read")).toBe(
      -Infinity,
    );
  });

  it("guards double injection and allows teardown", async () => {
    const { dom, api } = await loadContent("<article>Readable text</article>");
    expect(
      dom.window.document.querySelectorAll("#umbra-overlay-host"),
    ).toHaveLength(1);

    dom.window.eval(read("umbra-extension/content.js"));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(
      dom.window.document.querySelectorAll("#umbra-overlay-host"),
    ).toHaveLength(1);

    api.teardown();
    expect(
      dom.window.document.querySelectorAll("#umbra-overlay-host"),
    ).toHaveLength(0);
  });

  it("detects same-document URL changes", async () => {
    const { dom, api } = await loadContent("<article>Readable text</article>");
    dom.window.history.pushState({}, "", "/next");

    expect(api.handleLocationChange()).toBe(true);
    expect(api.state.lastHref).toBe("https://example.com/next");
  });
});
