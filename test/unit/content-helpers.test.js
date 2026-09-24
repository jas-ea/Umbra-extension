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
  dom.window.eval(read("umbra-extension/focus-policy.js"));
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

  it("lets an explicit automatic site choice override utility suppression", async () => {
    const { api } = await loadContent(
      '<main role="application"><button>One</button><button>Two</button></main>',
    );
    api.state.siteProfile = { intent: "utility", defaultMode: "manual" };
    api.state.settings.siteOverrides = { "example.com": "auto" };

    expect(api.currentSiteMode()).toBe("auto");
    expect(api.autoBlockedReason()).toBeNull();
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

  it("prefers the explicit surface under the pointer over a nearby mapped surface", async () => {
    const { dom, api } = await loadContent(
      '<main><p id="nearby">A much longer neighboring paragraph with enough text to otherwise win a density score.</p><p id="direct">Direct target.</p></main>',
    );
    const nearby = dom.window.document.getElementById("nearby");
    const direct = dom.window.document.getElementById("direct");
    setRect(nearby, rect(200, 80, 600, 80));
    setRect(direct, rect(200, 160, 600, 50));
    dom.window.document.elementFromPoint = () => direct;
    api.state.siteProfile = {
      intent: "article",
      surfaceSelectors: ["main p"],
      preferSelectors: ["main p"],
      quickSelectors: ["main p"],
      detailSelectors: [],
      collectionSelectors: [],
      rejectSelectors: [],
      rejectTokens: [],
    };
    api.state.surfaceMap.entries = [
      { element: nearby, rect: nearby.getBoundingClientRect() },
    ];

    const target = api.resolvedTargetFromPoint("read", { x: 500, y: 185 });
    expect(target.surface).toBe(direct);
  });

  it("uses the nearest declared surface instead of selector order", async () => {
    const { dom, api } = await loadContent(
      '<main id="shell"><article id="turn"><p id="copy">Readable answer text.</p></article></main>',
    );
    const shell = dom.window.document.getElementById("shell");
    const turn = dom.window.document.getElementById("turn");
    const copy = dom.window.document.getElementById("copy");
    setRect(shell, rect(0, 0, 1024, 700));
    setRect(turn, rect(180, 80, 680, 260));
    setRect(copy, rect(200, 110, 620, 80));
    dom.window.document.elementFromPoint = () => copy;
    api.state.siteProfile = {
      intent: "chat",
      surfaceSelectors: ["main", "article"],
      preferSelectors: ["main", "article"],
      quickSelectors: [],
      detailSelectors: [],
      collectionSelectors: [],
      collectionItemSelectors: [],
      rejectSelectors: [],
      rejectTokens: [],
    };

    const target = api.resolvedTargetFromPoint("read", { x: 300, y: 140 });
    expect(target.surface).toBe(turn);
  });

  it("does not reject a declared message because an outer app wrapper mentions the composer", async () => {
    const { dom, api } = await loadContent(
      '<main class="composer-parent"><article id="message" data-message-author-role="assistant"><p id="copy">Readable answer text.</p></article><form class="composer"><textarea></textarea></form></main>',
    );
    const message = dom.window.document.getElementById("message");
    const copy = dom.window.document.getElementById("copy");
    setRect(message, rect(180, 80, 680, 260));
    setRect(copy, rect(200, 110, 620, 80));
    dom.window.document.elementFromPoint = () => copy;
    api.state.siteProfile = dom.window.UMBRA_SITE_PROFILES.find(
      (profile) => profile.id === "chatgpt",
    );

    const target = api.resolvedTargetFromPoint("read", { x: 300, y: 140 });
    expect(target.surface).toBe(message);
  });

  it("localizes focus inside a multi-screen conversation turn", async () => {
    const { dom, api } = await loadContent(
      '<article id="turn" data-message-author-role="assistant"><section><p id="copy">Current paragraph.</p></section></article>',
    );
    const turn = dom.window.document.getElementById("turn");
    const copy = dom.window.document.getElementById("copy");
    setRect(turn, rect(120, -900, 760, 2400));
    setRect(copy, rect(160, 220, 680, 120));
    dom.window.document.elementFromPoint = () => copy;
    api.state.siteProfile = dom.window.UMBRA_SITE_PROFILES.find(
      (profile) => profile.id === "chatgpt",
    );

    const target = api.resolvedTargetFromPoint("read", { x: 300, y: 260 });
    expect(target.surface).toBe(copy);
  });

  it("lets manual selection choose a useful region inside rejected navigation", async () => {
    const { dom, api } = await loadContent(
      '<nav id="rail"><div id="thread"><strong>Project</strong><p id="copy">Conversation summary</p></div></nav><main></main>',
    );
    const rail = dom.window.document.getElementById("rail");
    const thread = dom.window.document.getElementById("thread");
    const copy = dom.window.document.getElementById("copy");
    setRect(rail, rect(0, 0, 250, 768));
    setRect(thread, rect(18, 100, 214, 76));
    setRect(copy, rect(30, 130, 190, 30));
    api.state.pointerX = 120;
    api.state.pointerY = 145;
    api.state.siteProfile = dom.window.UMBRA_SITE_PROFILES.find(
      (profile) => profile.id === "chatgpt",
    );

    expect(api.directSurfaceFromPointer("read", copy)).toBe(thread);
  });

  it("uses text bounds when adjacent layout inflates a reading block", async () => {
    const { dom, api } = await loadContent(
      '<main><p id="intro">A long introduction that wraps beside a floated infobox across many visible lines.</p></main>',
    );
    const intro = dom.window.document.getElementById("intro");
    setRect(intro, rect(200, 100, 800, 320));
    dom.window.document.createRange = () => ({
      selectNodeContents() {},
      getBoundingClientRect: () => rect(200, 104, 380, 308),
      detach() {},
    });
    api.state.activeMode = "read";

    const focused = api.rectForElement(intro);
    expect(focused.left).toBe(200 - api.state.settings.paddingX);
    expect(focused.right).toBe(580 + api.state.settings.paddingX);
  });

  it("frames a single readable text line after applying padding", async () => {
    const { dom, api } = await loadContent(
      '<main><p id="line">A readable line under the pointer.</p></main>',
    );
    const line = dom.window.document.getElementById("line");
    setRect(line, rect(200, 100, 420, 22));
    api.state.activeMode = "read";

    const focused = api.rectForElement(line);
    expect(focused.height).toBe(22 + api.state.settings.paddingY * 2);
  });

  it("promotes a composite inbox row to its collection surface", async () => {
    const { dom, api } = await loadContent(
      '<div id="inbox" role="grid"><div id="row" role="row">Mail</div><div role="row">Mail</div><div role="row">Mail</div><div role="row">Mail</div></div>',
    );
    const inbox = dom.window.document.getElementById("inbox");
    const row = dom.window.document.getElementById("row");
    setRect(inbox, rect(200, 80, 700, 500));
    for (const [index, item] of [...inbox.children].entries()) {
      setRect(item, rect(200, 80 + index * 60, 700, 56));
    }
    dom.window.document.elementFromPoint = () => row;
    api.state.siteProfile = {
      intent: "workspace",
      collectionSelectors: ['[role="grid"]'],
      detailSelectors: [],
      surfaceSelectors: ['[role="row"]'],
      preferSelectors: ['[role="row"]'],
      quickSelectors: ['[role="row"]'],
      rejectSelectors: [],
      rejectTokens: [],
    };

    const target = api.resolvedTargetFromPoint("read", { x: 300, y: 110 }, row);
    expect(target.surface).toBe(inbox);
    expect(target.mode).toBe("scan");
  });

  it("keeps strict workspace chrome out of collection ownership", async () => {
    const { dom, api } = await loadContent(
      '<main role="main"><div id="grid" role="grid"><div id="controls" role="toolbar"><button id="refresh">Refresh</button></div><div id="row" role="row">Mail</div></div></main>',
    );
    const grid = dom.window.document.getElementById("grid");
    const controls = dom.window.document.getElementById("controls");
    const refresh = dom.window.document.getElementById("refresh");
    const row = dom.window.document.getElementById("row");
    setRect(grid, rect(200, 80, 700, 500));
    setRect(controls, rect(200, 80, 700, 48));
    setRect(refresh, rect(220, 88, 90, 32));
    setRect(row, rect(200, 128, 700, 56));
    api.state.siteProfile = {
      intent: "workspace",
      strictTargeting: true,
      collectionSelectors: ['[role="grid"]'],
      collectionItemSelectors: ['[role="row"]'],
      detailSelectors: [],
      rejectSelectors: ['[role="toolbar"]'],
      rejectTokens: [],
    };

    expect(api.collectionSurfaceFrom(refresh)).toBeNull();
    expect(api.collectionSurfaceFrom(row)).toBe(grid);
    expect(
      api.resolvedTargetFromPoint("read", { x: 250, y: 100 }, refresh),
    ).toBeNull();
  });

  it("promotes a generic ARIA list while rejecting a navigation grid", async () => {
    const { dom, api } = await loadContent(
      '<nav><div id="mini" role="grid"><div id="mini-row" role="row">1</div><div role="row">2</div><div role="row">3</div><div role="row">4</div></div></nav><main><div id="tasks" role="list"><div id="task" role="listitem">A</div><div role="listitem">B</div><div role="listitem">C</div><div role="listitem">D</div></div></main>',
    );
    const mini = dom.window.document.getElementById("mini");
    const miniRow = dom.window.document.getElementById("mini-row");
    const tasks = dom.window.document.getElementById("tasks");
    const task = dom.window.document.getElementById("task");
    for (const collection of [mini, tasks]) {
      setRect(collection, rect(20, 20, 500, 300));
      for (const [index, item] of [...collection.children].entries()) {
        setRect(item, rect(20, 20 + index * 50, 500, 44));
      }
    }
    api.state.siteProfile = {
      intent: "workspace",
      collectionSelectors: ['[role="grid"]'],
      surfaceSelectors: ['[role="grid"]'],
      rejectSelectors: ["nav"],
      rejectTokens: [],
    };

    expect(api.collectionSurfaceFrom(miniRow)).toBeNull();
    expect(api.collectionSurfaceFrom(task)).toBe(tasks);
  });

  it("infers a repeated collection on an unfamiliar workspace", async () => {
    const { dom, api } = await loadContent(
      '<main><section id="folders"><div id="folder">Alpha</div><div>Beta</div><div>Gamma</div><div>Delta</div><div>Epsilon</div></section></main>',
    );
    const folders = dom.window.document.getElementById("folders");
    const folder = dom.window.document.getElementById("folder");
    setRect(folders, rect(160, 80, 560, 340));
    for (const [index, item] of [...folders.children].entries()) {
      setRect(item, rect(180, 100 + index * 58, 520, 50));
    }
    api.state.siteProfile = {
      intent: "workspace",
      collectionSelectors: [],
      collectionItemSelectors: [],
      surfaceSelectors: [],
      rejectSelectors: [],
      rejectTokens: [],
    };

    expect(api.collectionSurfaceFrom(folder)).toBe(folders);
  });

  it("does not match site profiles on lookalike domains", async () => {
    const { dom } = await loadContent();
    const slack = dom.window.UMBRA_SITE_PROFILES.find(
      (profile) => profile.id === "slack",
    );
    const calendar = dom.window.UMBRA_SITE_PROFILES.find(
      (profile) => profile.id === "google-calendar",
    );
    const context = (host) => ({
      host,
      pathname: "/",
      href: `https://${host}/`,
      doc: dom.window.document,
    });

    expect(slack.match(context("app.slack.com"))).toBe(true);
    expect(slack.match(context("fakeslack.com"))).toBe(false);
    expect(calendar.match(context("calendar.google.com"))).toBe(true);
    expect(calendar.match(context("fakecalendar.google.com.example"))).toBe(
      false,
    );
  });

  it("recognizes the release matrix across current dense sites", async () => {
    const { dom } = await loadContent();
    const context = (host, pathname = "/") => ({
      host,
      pathname,
      href: `https://${host}${pathname}`,
      doc: dom.window.document,
    });
    const profile = (id) =>
      dom.window.UMBRA_SITE_PROFILES.find((candidate) => candidate.id === id);

    const cases = [
      ["chatgpt", "chatgpt.com", "/c/example"],
      ["claude", "claude.ai", "/chat/example"],
      ["gemini", "gemini.google.com", "/app/example"],
      ["grok", "grok.com", "/c/example"],
      ["x-timeline", "x.com", "/home"],
      ["instagram-feed", "www.instagram.com", "/"],
      ["linkedin-feed", "www.linkedin.com", "/feed/"],
      ["reddit", "www.reddit.com", "/r/programming/"],
      ["youtube", "www.youtube.com", "/watch"],
      ["discord", "discord.com", "/channels/1/2"],
      ["gmail", "mail.google.com", "/mail/u/0/"],
      ["google-calendar", "calendar.google.com", "/calendar/u/0/"],
      ["slack", "app.slack.com", "/client/example"],
      ["github-issues", "github.com", "/openai/openai-cookbook/issues"],
      ["stackoverflow-questions", "stackoverflow.com", "/questions"],
      ["hacker-news-item", "news.ycombinator.com", "/item"],
      ["wikipedia-reference", "en.wikipedia.org", "/wiki/Attention"],
      ["chrome-developer-docs", "developer.chrome.com", "/docs/extensions/"],
    ];

    for (const [id, host, pathname] of cases) {
      expect(profile(id).match(context(host, pathname)), id).toBe(true);
    }
  });

  it("targets declared content units on new dense-site profiles", async () => {
    const cases = [
      [
        "linkedin-feed",
        '<main><article id="target" class="feed-shared-update-v2"><p id="point">Feed post</p></article></main>',
      ],
      [
        "reddit",
        '<main><shreddit-post id="target"><p id="point">Discussion post</p></shreddit-post></main>',
      ],
      [
        "youtube",
        '<main><ytd-video-renderer id="target"><p id="point">Video result</p></ytd-video-renderer></main>',
      ],
      [
        "grok",
        '<main><article id="target" data-testid="message-row"><p id="point">Assistant answer</p></article></main>',
      ],
    ];

    for (const [profileId, body] of cases) {
      const { dom, api } = await loadContent(body);
      const target = dom.window.document.getElementById("target");
      const point = dom.window.document.getElementById("point");
      setRect(target, rect(180, 80, 680, 260));
      setRect(point, rect(200, 110, 620, 80));
      dom.window.document.elementFromPoint = () => point;
      api.state.siteProfile = dom.window.UMBRA_SITE_PROFILES.find(
        (profile) => profile.id === profileId,
      );

      expect(
        api.resolvedTargetFromPoint("read", { x: 300, y: 140 }).surface,
        profileId,
      ).toBe(target);
    }
  });

  it("treats a GitHub issue row as part of the issue list", async () => {
    const { dom, api } = await loadContent(
      '<main><section class="SidebarPageLayout-module__Root"><ul id="issues" role="list" data-listview-component="items-list"><li id="issue" role="listitem">Issue</li></ul></section></main>',
    );
    const profile = dom.window.UMBRA_SITE_PROFILES.find(
      (candidate) => candidate.id === "github-issues",
    );
    const issues = dom.window.document.getElementById("issues");
    const issue = dom.window.document.getElementById("issue");
    setRect(issues, rect(200, 80, 800, 500));
    setRect(issue, rect(200, 140, 800, 64));
    api.state.siteProfile = profile;

    const target = api.resolvedTargetFromPoint(
      "read",
      { x: 600, y: 172 },
      issue,
    );
    expect(profile.strictTargeting).toBe(true);
    expect(target.surface).toBe(issues);
    expect(target.mode).toBe("scan");
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

  it("preserves pinned focus while a tab is hidden and restores it on return", async () => {
    const { dom, api } = await loadContent(
      '<article id="pinned">Pinned reading surface</article>',
    );
    const pinned = dom.window.document.getElementById("pinned");
    setRect(pinned, rect(80, 90, 520, 260));

    api.switchSurface(pinned, "read", { pin: true });
    expect(api.state.visible).toBe(true);
    api.handleVisibility(true);
    expect(api.state.visible).toBe(false);
    expect(api.state.activeSurface).toBe(pinned);
    expect(api.state.pinned).toBe(true);
    api.handleVisibility(false);
    expect(api.state.visible).toBe(true);
    expect(api.state.activeSurface).toBe(pinned);
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
