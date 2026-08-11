import { test, expect, chromium } from "@playwright/test";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const extensionPath = path.join(repoRoot, "umbra-extension");
const fixtureRoot = path.join(repoRoot, "test/fixtures");

const fastSettings = {
  enabled: true,
  dwellMs: 120,
  scrollIdleMs: 80,
  overlayOpacity: 0.58,
  paddingX: 24,
  paddingY: 20,
  cornerRadius: 18,
  transitionMs: 0,
  stationaryTolerance: 10,
  revealBuffer: 44,
  hideGraceMs: 0,
  actionLockMs: 120,
  pointerPriorityMs: 60,
  refocusCooldownMs: 300,
  autoOnScroll: true,
  autoOnHover: true,
  showOutline: true,
  siteOverrides: {},
  appAutoSuppress: false,
  debug: false,
};

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function startFixtureServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/article.html" : url.pathname;
    const filePath = path.resolve(fixtureRoot, `.${pathname}`);
    if (!filePath.startsWith(`${fixtureRoot}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const body = await readFile(filePath);
      response.writeHead(200, { "content-type": contentType(filePath) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    substackOrigin: `http://substack.com:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function serviceWorker(context) {
  return (
    context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"))
  );
}

async function setExtensionSettings(context, overrides = {}) {
  const worker = await serviceWorker(context);
  const settings = { ...fastSettings, ...overrides };
  await worker.evaluate(
    (nextSettings) =>
      new Promise((resolve) => {
        chrome.storage.sync.clear(() => {
          chrome.storage.sync.set(nextSettings, resolve);
        });
      }),
    settings,
  );
}

async function updateExtensionSettings(context, overrides = {}) {
  const worker = await serviceWorker(context);
  await worker.evaluate(
    (nextSettings) =>
      new Promise((resolve) => chrome.storage.sync.set(nextSettings, resolve)),
    overrides,
  );
}

async function shellInfo(page) {
  return page.evaluate(() => {
    const host = document.getElementById("umbra-overlay-host");
    const shell = host?.shadowRoot?.querySelector(".shell");
    const mask = host?.shadowRoot?.querySelector(".mask");
    const maskPath = mask?.querySelector("path");
    if (!host || !shell) return null;
    const rect = shell.getBoundingClientRect();
    const style = getComputedStyle(shell);
    return {
      visible: shell.classList.contains("visible"),
      preview: shell.classList.contains("preview"),
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderTopColor: style.borderTopColor,
      borderRadius: style.borderTopLeftRadius,
      boxShadow: style.boxShadow,
      transitionProperty: style.transitionProperty,
      ariaHidden: host.getAttribute("aria-hidden"),
      maskVisible: mask?.classList.contains("visible") || false,
      maskFill: maskPath ? getComputedStyle(maskPath).fill : "",
      maskPath: maskPath?.getAttribute("d") || "",
    };
  });
}

async function focusByHover(page, selector, options = {}) {
  await expect
    .poll(async () =>
      page.evaluate(() => !!document.getElementById("umbra-overlay-host")),
    )
    .toBe(true);
  const locator = page.locator(selector);
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(async () => {
      const shell = await shellInfo(page);
      return shell?.visible && !shell?.preview && shell?.maskVisible;
    })
    .toBe(true);
  if (options.waitForRect) {
    const focused = await waitForFocusedRect(page, selector, options.tolerance);
    return focused.target;
  }
  return box;
}

async function sendExtensionMessage(context, page, message) {
  const worker = await serviceWorker(context);
  return worker.evaluate(
    async ({ pageUrl, payload }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((candidate) => candidate.url === pageUrl);
      if (!tab?.id) return null;
      return chrome.tabs.sendMessage(tab.id, payload);
    },
    { pageUrl: page.url(), payload: message },
  );
}

function expectClose(actual, expected, tolerance = 3) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function rectCoversElement(shell, target, tolerance = 4) {
  return (
    Math.abs(shell.left - (target.x - fastSettings.paddingX)) <= tolerance &&
    Math.abs(shell.top - (target.y - fastSettings.paddingY)) <= tolerance &&
    Math.abs(shell.width - (target.width + fastSettings.paddingX * 2)) <=
      tolerance &&
    Math.abs(shell.height - (target.height + fastSettings.paddingY * 2)) <=
      tolerance
  );
}

function expectRectCoversElement(shell, target, tolerance = 4) {
  expect(rectCoversElement(shell, target, tolerance)).toBe(true);
}

async function waitForFocusedRect(page, selector, tolerance = 4) {
  await expect
    .poll(async () => {
      const target = await page.locator(selector).boundingBox();
      const shell = await shellInfo(page);
      if (!target || !shell?.visible || shell.preview || !shell.maskVisible) {
        return false;
      }
      return rectCoversElement(shell, target, tolerance);
    })
    .toBe(true);
  return {
    target: await page.locator(selector).boundingBox(),
    shell: await shellInfo(page),
  };
}

test.describe("Umbra extension fixtures", () => {
  let server;
  let context;

  test.beforeAll(async () => {
    server = await startFixtureServer();
    context = await chromium.launchPersistentContext(
      path.join(os.tmpdir(), `umbra-pw-${Date.now()}`),
      {
        headless: false,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
          "--host-resolver-rules=MAP substack.com 127.0.0.1",
        ],
      },
    );
  });

  test.afterAll(async () => {
    await context?.close();
    await server?.close();
  });

  test.beforeEach(async () => {
    await setExtensionSettings(context);
  });

  test("cuts out the article surface with padding and toggles outline", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/article.html`);
    const target = await focusByHover(page, "#target-article", {
      waitForRect: true,
    });
    const shell = await shellInfo(page);

    expect(shell.ariaHidden).toBe("true");
    expectClose(shell.left, target.x - fastSettings.paddingX);
    expectClose(shell.top, target.y - fastSettings.paddingY);
    expectClose(shell.width, target.width + fastSettings.paddingX * 2);
    expectClose(shell.height, target.height + fastSettings.paddingY * 2);
    expect(shell.borderRadius).toBe("18px");
    expect(shell.maskVisible).toBe(true);
    expect(shell.maskPath).toContain("A18 18");
    expect(shell.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");

    await updateExtensionSettings(context, { showOutline: false });
    await expect
      .poll(async () => (await shellInfo(page))?.borderTopColor)
      .toBe("rgba(0, 0, 0, 0)");
    await page.close();
  });

  test("targets a ChatGPT-like message inside a noisy app shell", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/noisy-chat-app.html`);
    const target = await focusByHover(page, "#assistant-message-one", {
      waitForRect: true,
    });
    const shell = await shellInfo(page);

    expectRectCoversElement(shell, target);
    expect(shell.maskVisible).toBe(true);
    expect(shell.maskPath).toContain("A18 18");
    await page.close();
  });

  test("switches cleanly between chat messages and ignores the sticky composer", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/noisy-chat-app.html`);
    const firstTarget = await focusByHover(page, "#assistant-message-one", {
      waitForRect: true,
    });
    const firstShell = await shellInfo(page);

    const secondTarget = await focusByHover(page, "#assistant-message-two", {
      waitForRect: true,
    });
    const secondShell = await shellInfo(page);
    const composer = await page.locator("#composer-shell").boundingBox();

    expectRectCoversElement(firstShell, firstTarget);
    expectRectCoversElement(secondShell, secondTarget);
    expect(secondShell.top).toBeGreaterThan(firstShell.top);
    expect(
      Math.abs(secondShell.top - (composer.y - fastSettings.paddingY)),
    ).toBeGreaterThan(30);
    await page.close();
  });

  test("targets an X-like timeline post instead of rails, ads, or drawers", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/noisy-social-feed.html`);
    const target = await focusByHover(page, "#tweet-one", {
      waitForRect: true,
    });
    const shell = await shellInfo(page);

    expectRectCoversElement(shell, target);
    expect(shell.maskVisible).toBe(true);
    expect(shell.width).toBeLessThan(760);
    await page.close();
  });

  test("switches cleanly across noisy timeline posts", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/noisy-social-feed.html`);
    const firstTarget = await focusByHover(page, "#tweet-one", {
      waitForRect: true,
    });
    const firstShell = await shellInfo(page);

    const secondTarget = await focusByHover(page, "#tweet-two", {
      waitForRect: true,
    });
    const secondShell = await shellInfo(page);

    expectRectCoversElement(firstShell, firstTarget);
    expectRectCoversElement(secondShell, secondTarget);
    expect(secondShell.top).toBeGreaterThan(firstShell.top);
    expect(secondShell.height).toBeLessThan(firstShell.height);
    await page.close();
  });

  test("tracks an active surface inside a nested scroller", async () => {
    const page = await context.newPage();
    await page.goto(`${server.substackOrigin}/chat-stream.html`);
    await page.locator("#chatScroll").evaluate((node) => {
      node.scrollTop = 300;
    });
    await focusByHover(page, "#message-one");

    await page.locator("#chatScroll").evaluate((node) => {
      node.scrollTop += 120;
    });
    await page.waitForTimeout(120);

    const target = await page.locator("#message-one").boundingBox();
    const shell = await shellInfo(page);
    expect(shell.visible).toBe(true);
    expectClose(shell.top, target.y - fastSettings.paddingY, 5);
    await page.close();
  });

  test("debounces mutation refresh during chat streaming", async () => {
    const page = await context.newPage();
    await page.goto(`${server.substackOrigin}/chat-stream.html`);
    await page.locator("#chatScroll").evaluate((node) => {
      node.scrollTop = 620;
    });
    await focusByHover(page, "#message-two");

    const delta = await page.evaluate(async () => {
      const before = window.__umbraRectReads;
      for (let index = 0; index < 20; index += 1) window.appendStreamChunk();
      await new Promise((resolve) => setTimeout(resolve, 260));
      return window.__umbraRectReads - before;
    });

    expect(delta).toBeLessThanOrEqual(12);
    await page.close();
  });

  test("keeps route-change handling alive after same-document navigation", async () => {
    const page = await context.newPage();
    await page.goto(`${server.substackOrigin}/feed.html`);
    await focusByHover(page, "#feed-card");
    await page.locator("#routeArticle").click();
    await expect(page).toHaveURL(/\/article$/);
    await focusByHover(page, "#feed-card");
    expect((await shellInfo(page)).visible).toBe(true);
    await page.close();
  });

  test("uses the viewport reading band for scroll-stop focus", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, {
      readingBandY: 0.42,
      refocusCooldownMs: 80,
    });
    await page.goto(`${server.substackOrigin}/feed.html`);
    await page.mouse.move(24, 24);
    await page.evaluate((bandY) => {
      const target = document.getElementById("feed-card-two");
      window.scrollTo(
        0,
        target.offsetTop + target.offsetHeight / 2 - window.innerHeight * bandY,
      );
    }, 0.42);
    await page.waitForTimeout(800);
    const shell = await shellInfo(page);
    const target = await page.locator("#feed-card-two").boundingBox();
    const shellCenter = shell.top + shell.height / 2;
    const targetCenter = target.y + target.height / 2;
    expect(shell.visible && !shell.preview).toBe(true);
    expect(
      Math.abs(shellCenter - targetCenter),
      JSON.stringify({ shell, target }),
    ).toBeLessThanOrEqual(8);
    await page.close();
  });

  test("does not let refocus cooldown delay a settled hover", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, {
      dwellMs: 120,
      refocusCooldownMs: 5000,
    });
    await page.goto(`${server.origin}/article.html`);

    const target = await page.locator("#target-article").boundingBox();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
    );

    await expect
      .poll(async () => {
        const shell = await shellInfo(page);
        return shell?.visible && !shell?.preview && shell?.maskVisible;
      })
      .toBe(true);
    await page.close();
  });

  test("targets generic readable cards instead of the page shell", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/generic-cards.html`);
    const target = await focusByHover(page, "#target-card", {
      waitForRect: true,
    });
    const shell = await shellInfo(page);

    expectClose(shell.left, target.x - fastSettings.paddingX);
    expectClose(shell.top, target.y - fastSettings.paddingY);
    expectClose(shell.width, target.width + fastSettings.paddingX * 2);
    expectClose(shell.height, target.height + fastSettings.paddingY * 2);
    expect(shell.maskPath).toContain("A18 18");
    await page.close();
  });

  test("manual focus and pin use the viewport when pointer state is stale", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/article.html`);

    await sendExtensionMessage(context, page, { type: "UMBRA_FOCUS_NOW" });
    await expect.poll(async () => (await shellInfo(page))?.visible).toBe(true);
    const focusedShell = await shellInfo(page);

    await sendExtensionMessage(context, page, { type: "UMBRA_PIN_NOW" });
    await page.mouse.move(10, 10);
    await page.waitForTimeout(180);
    const pinnedShell = await shellInfo(page);
    expect(pinnedShell.visible).toBe(true);
    expectClose(pinnedShell.left, focusedShell.left);
    await page.close();
  });

  test("shows a boundary preview before hover dwell", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, { dwellMs: 900 });
    await page.goto(`${server.origin}/article.html`);
    const target = await page.locator("#target-article").boundingBox();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
    );

    await expect
      .poll(async () => {
        const shell = await shellInfo(page);
        return shell?.visible && shell?.preview && shell?.boxShadow === "none";
      })
      .toBe(true);
    await page.close();
  });

  test("applies rich dimming customization without dead controls", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, {
      dimTint: "#123456",
      edgeFeather: 12,
      solidDim: true,
      focusMode: "band",
    });
    await page.goto(`${server.origin}/article.html`);
    await focusByHover(page, "#target-article");

    const shell = await shellInfo(page);
    expect(shell.height).toBeLessThanOrEqual(260);
    expect(shell.boxShadow).toContain("12px");
    expect(shell.maskVisible).toBe(true);
    expect(shell.maskFill).toBe("rgb(18, 52, 86)");
    await page.close();
  });

  test("uses the rounded mask on transformed roots and hides for native modals", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/transformed-html.html`);
    await focusByHover(page, "#transformed-target");
    let shell = await shellInfo(page);
    expect(shell.maskVisible).toBe(true);

    await page.evaluate(() => {
      const dialog = document.createElement("dialog");
      dialog.textContent = "Native modal";
      document.body.append(dialog);
      dialog.showModal();
    });
    await page.mouse.move(100, 100);
    await expect.poll(async () => (await shellInfo(page))?.visible).toBe(false);
    shell = await shellInfo(page);
    expect(shell.maskVisible).toBe(false);
    await page.close();
  });

  test("respects reduced motion and forced colors media features", async () => {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${server.origin}/article.html`);
    await focusByHover(page, "#target-article");
    expect((await shellInfo(page)).transitionProperty).toBe("opacity");

    await page.emulateMedia({ forcedColors: "active" });
    await expect
      .poll(async () => (await shellInfo(page))?.boxShadow)
      .toBe("none");
    await page.close();
  });

  test("does not pin when Shift+Click extends a text selection", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, {
      siteOverrides: { "127.0.0.1": "manual" },
    });
    await page.goto(`${server.origin}/article.html`);
    await page.evaluate(() => {
      const paragraph = document.querySelector("#target-article p");
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });

    const target = await page.locator("#target-article").boundingBox();
    await page.mouse.click(
      target.x + target.width / 2,
      target.y + target.height / 2,
      {
        modifiers: ["Shift"],
      },
    );
    await page.waitForTimeout(160);

    expect((await shellInfo(page))?.visible || false).toBe(false);
    await page.close();
  });
});
