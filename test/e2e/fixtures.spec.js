import { test, expect, chromium } from "@playwright/test";
import http from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const extensionPath = path.join(repoRoot, "umbra-extension");
const fixtureRoot = path.join(repoRoot, "test/fixtures");

const fastSettings = {
  enabled: true,
  dwellMs: 120,
  refocusDwellMs: 180,
  scrollIdleMs: 80,
  overlayOpacity: 0.58,
  paddingX: 24,
  paddingY: 20,
  cornerRadius: 18,
  transitionMs: 0,
  stationaryTolerance: 10,
  pointerQuietMs: 30,
  revealBuffer: 44,
  hideGraceMs: 0,
  noTargetHoldMs: 400,
  actionLockMs: 120,
  interactionGraceMs: 160,
  fullscreenExitGraceMs: 200,
  mediaFocusMs: 50,
  autoOnScroll: true,
  autoOnHover: true,
  showOutline: true,
  siteOverrides: {},
  appAutoSuppress: false,
  behaviorDefaultsVersion: 1,
  debug: true,
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
    chatgptOrigin: `http://chatgpt.com:${port}`,
    xOrigin: `http://x.com:${port}`,
    gmailOrigin: `http://mail.google.com:${port}`,
    calendarOrigin: `http://calendar.google.com:${port}`,
    slackOrigin: `http://app.slack.com:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function serviceWorker(context) {
  return (
    context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"))
  );
}

async function extensionOrigin(context) {
  const workerUrl = (await serviceWorker(context)).url();
  const extensionId = new URL(workerUrl).hostname;
  return `chrome-extension://${extensionId}`;
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
  await page.mouse.move(4, 4);
  await page.waitForTimeout(24);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(async () => {
      const shell = await shellInfo(page);
      return shell?.visible && !shell?.preview && shell?.maskVisible;
    })
    .toBe(true);
  if (options.expectedSurfaceId && options.context) {
    await expect
      .poll(async () => activeSurfaceId(options.context, page))
      .toBe(options.expectedSurfaceId);
  }
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

async function extensionState(context, page) {
  return sendExtensionMessage(context, page, { type: "UMBRA_GET_STATE" });
}

async function activeSurfaceId(context, page) {
  return (await extensionState(context, page))?.activeSurfaceId || "";
}

async function storedTabPause(context, page) {
  const worker = await serviceWorker(context);
  return worker.evaluate(async (pageUrl) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === pageUrl);
    if (!tab?.id) return false;
    const stored = await chrome.storage.session.get("pausedTabIds");
    return (stored.pausedTabIds || []).includes(tab.id);
  }, page.url());
}

function expectClose(actual, expected, tolerance = 3) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function rectCoversElement(shell, target, tolerance = 4) {
  const left = Math.max(0, target.x - fastSettings.paddingX);
  const top = Math.max(0, target.y - fastSettings.paddingY);
  const right = Math.min(1280, target.x + target.width + fastSettings.paddingX);
  const bottom = Math.min(
    900,
    target.y + target.height + fastSettings.paddingY,
  );
  return (
    Math.abs(shell.left - left) <= tolerance &&
    Math.abs(shell.top - top) <= tolerance &&
    Math.abs(shell.width - (right - left)) <= tolerance &&
    Math.abs(shell.height - (bottom - top)) <= tolerance
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
  let contextPath;

  test.beforeAll(async () => {
    server = await startFixtureServer();
    contextPath = await mkdtemp(path.join(os.tmpdir(), "umbra-pw-"));
    context = await chromium.launchPersistentContext(contextPath, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        [
          "--host-resolver-rules=MAP substack.com 127.0.0.1",
          "MAP chatgpt.com 127.0.0.1",
          "MAP x.com 127.0.0.1",
          "MAP mail.google.com 127.0.0.1",
          "MAP calendar.google.com 127.0.0.1",
          "MAP app.slack.com 127.0.0.1",
        ].join(", "),
      ],
    });
  });

  test.afterAll(async () => {
    await context?.close();
    await server?.close();
    if (contextPath) await rm(contextPath, { recursive: true, force: true });
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
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
    await expect
      .poll(async () => (await extensionState(context, page))?.profile)
      .toBe("chatgpt");
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
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
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
    await page.goto(`${server.xOrigin}/noisy-social-feed.html`);
    await expect
      .poll(async () => (await extensionState(context, page))?.profile)
      .toBe("x-timeline");
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
    await page.goto(`${server.xOrigin}/noisy-social-feed.html`);
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

  test("keeps Gmail chrome inert and moves between inbox and message", async () => {
    const page = await context.newPage();
    await page.goto(`${server.gmailOrigin}/productivity-workspace.html`);
    await expect
      .poll(async () => (await extensionState(context, page))?.profile)
      .toBe("gmail");

    for (const selector of ["#gmail-controls", "#inbox-sections"]) {
      await page.locator(selector).hover();
      await page.waitForTimeout(fastSettings.dwellMs + 120);
      const runtime = await extensionState(context, page);
      expect(runtime?.hasActiveSurface || false).toBe(false);
      expect((await shellInfo(page))?.maskVisible || false).toBe(false);
    }

    await page.locator("#gmail-refresh").click();
    const firstRow = await page.locator("#mail-row-1").boundingBox();
    await page.mouse.move(
      firstRow.x + firstRow.width / 2,
      firstRow.y + firstRow.height / 2,
    );
    await page.waitForTimeout(50);
    expect((await extensionState(context, page))?.hasActiveSurface).toBe(false);
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("inbox-grid");

    const rows = page.locator(".mail-row");
    for (let index = 1; index < 5; index += 1) {
      const row = await rows.nth(index).boundingBox();
      await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2);
      await page.waitForTimeout(fastSettings.refocusDwellMs + 80);
      expect(await activeSurfaceId(context, page)).toBe("inbox-grid");
    }

    await page.locator("#mail-row-1 .subject").click();
    await expect(page.locator("#opened-message-view")).toBeVisible();
    await page.locator("#opened-message-copy").hover();
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("opened-message-copy");
    expect((await extensionState(context, page))?.activeMode).toBe("read");
    await page.close();
  });

  test("keeps Calendar cells and events inside the week surface", async () => {
    const page = await context.newPage();
    await page.goto(`${server.calendarOrigin}/productivity-workspace.html`);
    await expect
      .poll(async () => (await extensionState(context, page))?.profile)
      .toBe("google-calendar");

    await focusByHover(page, "#calendar-event");
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("week-grid");

    const miniCell = await page.locator("#mini-calendar-cell").boundingBox();
    await page.mouse.move(
      miniCell.x + miniCell.width / 2,
      miniCell.y + miniCell.height / 2,
    );
    await page.waitForTimeout(260);
    expect(await activeSurfaceId(context, page)).not.toBe("mini-calendar");
    await page.close();
  });

  test("keeps Slack messages together and suspends for an open menu", async () => {
    const page = await context.newPage();
    await page.goto(`${server.slackOrigin}/productivity-workspace.html`);
    await expect
      .poll(async () => (await extensionState(context, page))?.profile)
      .toBe("slack");

    await focusByHover(page, ".message:nth-of-type(2)");
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("message-pane");

    await page.locator("#channel-menu-button").click();
    await expect(page.locator("#action-menu")).toBeVisible();
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(false);

    await page.getByRole("menuitem", { name: "More actions" }).click();
    await expect(page.locator("#submenu")).toBeVisible();
    expect((await shellInfo(page)).maskVisible).toBe(false);

    await page.keyboard.press("Escape");
    await expect(page.locator("#action-menu")).toBeHidden();
    await expect
      .poll(async () => {
        const shell = await shellInfo(page);
        return (
          shell?.maskVisible &&
          (await activeSurfaceId(context, page)) === "message-pane"
        );
      })
      .toBe(true);
    await page.close();
  });

  test("observes CSS-opened menus without treating tooltips as blockers", async () => {
    const page = await context.newPage();
    await page.goto(`${server.slackOrigin}/productivity-workspace.html`);
    await focusByHover(page, ".message:nth-of-type(2)");
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("message-pane");

    await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent =
        ".css-menu { display: none } .css-menu.open { display: block }";
      const tooltip = document.createElement("div");
      tooltip.id = "hover-tooltip";
      tooltip.role = "tooltip";
      tooltip.textContent = "More actions";
      Object.assign(tooltip.style, {
        position: "fixed",
        top: "80px",
        right: "24px",
      });
      const menu = document.createElement("div");
      menu.id = "css-menu";
      menu.className = "menu css-menu";
      menu.role = "menu";
      menu.innerHTML = '<button role="menuitem">Move message</button>';
      document.head.append(style);
      document.body.append(tooltip, menu);
    });
    await page.waitForTimeout(240);
    expect((await shellInfo(page)).maskVisible).toBe(true);

    await page
      .locator("#css-menu")
      .evaluate((menu) => menu.classList.add("open"));
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(false);
    await page
      .locator("#css-menu")
      .evaluate((menu) => menu.classList.remove("open"));
    await expect
      .poll(async () => {
        const shell = await shellInfo(page);
        return (
          shell?.maskVisible &&
          (await activeSurfaceId(context, page)) === "message-pane"
        );
      })
      .toBe(true);
    await page.close();
  });

  test("promotes direct grid cells to one collection on a noisy app page", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/productivity-workspace.html`);
    await page.evaluate(() => {
      const grid = document.createElement("div");
      grid.id = "direct-cell-grid";
      grid.role = "grid";
      grid.setAttribute("aria-label", "Available times");
      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
        gap: "8px",
        margin: "16px",
        padding: "16px",
      });
      for (let index = 0; index < 6; index += 1) {
        const cell = document.createElement("button");
        cell.id = `direct-cell-${index}`;
        cell.role = "gridcell";
        cell.textContent = `Time ${index + 1}`;
        cell.style.minHeight = "48px";
        grid.append(cell);
      }
      document.querySelector(".message-pane").prepend(grid);
    });

    await focusByHover(page, "#direct-cell-2");
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("direct-cell-grid");
    await page.close();
  });

  test("restores a pinned collection after a nested menu closes", async () => {
    const page = await context.newPage();
    await page.goto(`${server.slackOrigin}/productivity-workspace.html`);
    await sendExtensionMessage(context, page, { type: "UMBRA_BEGIN_PICK" });
    const message = page.locator(".message:nth-of-type(2)");
    await message.hover();
    await message.click();
    await expect
      .poll(async () => (await extensionState(context, page))?.pinned || false)
      .toBe(true);
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("message-pane");

    await page.locator("#channel-menu-button").click();
    await expect(page.locator("#action-menu")).toBeVisible();
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(false);
    await page.keyboard.press("Escape");
    await expect(page.locator("#action-menu")).toBeHidden();
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(true);

    await message.evaluate((element) => {
      element.dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    });
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(false);
    await message.evaluate((element) => {
      element.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
    });
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(true);

    await message.evaluate((element) => {
      element.addEventListener("click", () => element.requestFullscreen(), {
        once: true,
      });
    });
    await message.click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement !== null))
      .toBe(true);
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(false);
    await page.evaluate(() => document.exitFullscreen());
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(true);

    expect(await activeSurfaceId(context, page)).toBe("message-pane");
    await page.close();
  });

  test("gives user-started video stable ownership and suspends in fullscreen", async () => {
    const page = await context.newPage();
    await page.goto(`${server.slackOrigin}/productivity-workspace.html`);
    const video = page.locator("#inline-video");

    await video.click();
    await video.evaluate(async (element) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      canvas.getContext("2d").fillRect(0, 0, 320, 180);
      window.__umbraTestVideoCanvas = canvas;
      element.srcObject = canvas.captureStream(1);
      element.muted = false;
      element.volume = 1;
      await element.play();
    });
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("inline-player");

    await page.locator("#autoplay-video").evaluate((element) => {
      Object.defineProperties(element, {
        paused: { configurable: true, get: () => false },
        ended: { configurable: true, get: () => false },
      });
      element.muted = true;
      element.dispatchEvent(new Event("play"));
    });
    await page.waitForTimeout(140);
    expect(await activeSurfaceId(context, page)).toBe("inline-player");

    await video.evaluate((element) => {
      element.dispatchEvent(
        new Event("enterpictureinpicture", { bubbles: true }),
      );
    });
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(false);
    await expect
      .poll(
        async () =>
          (await extensionState(context, page))?.pictureInPictureMediaId || "",
      )
      .toBe("inline-video");
    await video.evaluate((element) => {
      element.dispatchEvent(
        new Event("leavepictureinpicture", { bubbles: true }),
      );
    });
    await expect
      .poll(
        async () =>
          (await extensionState(context, page))?.pictureInPictureMediaId || "",
      )
      .toBe("");
    await expect
      .poll(
        async () => (await extensionState(context, page))?.activeMediaId || "",
      )
      .toBe("inline-video");
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("inline-player");
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(true);

    await video.evaluate((element) => {
      element.addEventListener("click", () => element.requestFullscreen(), {
        once: true,
      });
    });
    await video.click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement?.id || ""))
      .toBe("inline-video");
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(false);

    await page.evaluate(() => document.exitFullscreen());
    await page.waitForTimeout(100);
    expect((await shellInfo(page)).maskVisible).toBe(false);
    await expect
      .poll(async () => (await shellInfo(page))?.maskVisible || false)
      .toBe(true);
    await page.close();
  });

  test("does not replace an incumbent before the refocus dwell completes", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, {
      dwellMs: 100,
      refocusDwellMs: 500,
      pointerQuietMs: 40,
    });
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
    await focusByHover(page, "#assistant-message-one", { waitForRect: true });
    const second = await page.locator("#assistant-message-two").boundingBox();
    await page.mouse.move(
      second.x + second.width / 2,
      second.y + second.height / 2,
    );

    await page.waitForTimeout(350);
    expect(await activeSurfaceId(context, page)).toBe("assistant-message-one");
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("assistant-message-two");
    await page.close();
  });

  test("waits for pointer quiet after continuous low-amplitude movement", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, {
      dwellMs: 220,
      pointerQuietMs: 160,
      stationaryTolerance: 20,
    });
    await page.goto(`${server.origin}/article.html`);
    const target = await page.locator("#target-article").boundingBox();
    const centerX = target.x + target.width / 2;
    const centerY = target.y + target.height / 2;

    for (let index = 0; index < 9; index += 1) {
      await page.mouse.move(centerX + (index % 3), centerY + (index % 2));
      await page.waitForTimeout(45);
    }
    expect((await shellInfo(page)).maskVisible).toBe(false);
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("target-article");
    await page.close();
  });

  test("ignores hidden interaction layers and cancels a pending exit hide", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, {
      dwellMs: 100,
      noTargetHoldMs: 100,
      hideGraceMs: 180,
    });
    await page.goto(`${server.origin}/article.html`);
    await page.evaluate(() => {
      const hiddenMenu = document.createElement("div");
      hiddenMenu.setAttribute("role", "menu");
      hiddenMenu.setAttribute("aria-hidden", "true");
      Object.assign(hiddenMenu.style, {
        position: "fixed",
        right: "10px",
        top: "10px",
        width: "180px",
        height: "220px",
      });
      document.body.append(hiddenMenu);
    });
    await focusByHover(page, "#target-article", {
      context,
      expectedSurfaceId: "target-article",
    });

    await page.mouse.move(10, 200);
    await page.waitForTimeout(130);
    const target = await page.locator("#target-article").boundingBox();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
    );
    await page.waitForTimeout(220);
    expect((await shellInfo(page)).maskVisible).toBe(true);
    expect(await activeSurfaceId(context, page)).toBe("target-article");
    await page.close();
  });

  test("tracks an active surface inside a nested scroller", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, { scrollIdleMs: 500 });
    await page.goto(`${server.chatgptOrigin}/chat-stream.html`);
    await page.locator("#chatScroll").evaluate((node) => {
      node.scrollTop = 300;
    });
    await focusByHover(page, "#message-one", {
      context,
      expectedSurfaceId: "message-one",
    });
    await expect
      .poll(async () => activeSurfaceId(context, page))
      .toBe("message-one");

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

  test("ignores the removed refocus cooldown during settings migration", async () => {
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

  test("keeps a tab paused after the page reloads", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/article.html`);

    expect(
      await sendExtensionMessage(context, page, {
        type: "UMBRA_TOGGLE_TAB_PAUSE",
      }),
    ).toEqual({ pausedForTab: true });
    await expect.poll(() => storedTabPause(context, page)).toBe(true);

    await page.reload();
    await expect
      .poll(async () => (await extensionState(context, page))?.pausedForTab)
      .toBe(true);
    expect((await shellInfo(page))?.visible || false).toBe(false);

    expect(
      await sendExtensionMessage(context, page, {
        type: "UMBRA_TOGGLE_TAB_PAUSE",
      }),
    ).toEqual({ pausedForTab: false });
    await expect.poll(() => storedTabPause(context, page)).toBe(false);
    await page.close();
  });

  test("saves surrounding darkness from the popup", async () => {
    const popup = await context.newPage();
    await popup.goto(`${await extensionOrigin(context)}/popup.html`);
    const targetPage = await context.newPage();
    await targetPage.goto(`${server.origin}/article.html`);
    await targetPage.bringToFront();
    await popup.reload();
    const slider = popup.locator("#darknessSlider");
    await expect(slider).toBeEnabled();
    await slider.evaluate((element) => {
      element.value = "0.82";
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(popup.locator("#darknessValue")).toHaveText("82%");
    await expect
      .poll(async () => {
        const worker = await serviceWorker(context);
        return worker.evaluate(async () => {
          const settings = await chrome.storage.sync.get([
            "overlayOpacity",
            "solidDim",
          ]);
          return settings;
        });
      })
      .toEqual({ overlayOpacity: 0.82, solidDim: false });
    await targetPage.close();
    await popup.close();
  });

  test("keeps settings small and resets individual site choices", async () => {
    await updateExtensionSettings(context, {
      siteOverrides: { "x.com": "off" },
    });
    const page = await context.newPage();
    await page.goto(`${await extensionOrigin(context)}/options.html`);

    await expect(page.locator("input[type=number]")).toHaveCount(0);
    await expect(page.locator("textarea")).toHaveCount(0);
    await expect(page.locator(".site-host")).toHaveText("x.com");
    await page
      .getByRole("button", { name: "Use the default behavior" })
      .click();

    await expect(page.locator(".empty-state")).toHaveText(
      "No site-specific changes",
    );
    await expect
      .poll(async () => {
        const worker = await serviceWorker(context);
        return worker.evaluate(async () => {
          const { siteOverrides } =
            await chrome.storage.sync.get("siteOverrides");
          return siteOverrides;
        });
      })
      .toEqual({});
    await page.close();
  });

  test("keeps the current cutout visible while confirming a new block", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, { dwellMs: 900, transitionMs: 180 });
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
    const first = await focusByHover(page, "#assistant-message-one", {
      waitForRect: true,
    });
    const second = await page.locator("#assistant-message-two").boundingBox();
    await page.mouse.move(
      second.x + second.width / 2,
      second.y + second.height / 2,
    );
    await page.waitForTimeout(80);

    const duringHandoff = await shellInfo(page);
    expect(duringHandoff.visible).toBe(true);
    expect(duringHandoff.maskVisible).toBe(true);
    expect(duringHandoff.maskPath).toContain("A18 18");
    expectClose(duringHandoff.left, first.x - fastSettings.paddingX, 5);

    await expect
      .poll(async () => {
        const shell = await shellInfo(page);
        return rectCoversElement(shell, second, 5);
      })
      .toBe(true);
    await page.close();
  });

  test("requires residence on one candidate before first focus", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, { dwellMs: 300 });
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
    const target = await page.locator("#assistant-message-one").boundingBox();
    const x = target.x + target.width / 2;

    for (let offset = 40; offset <= 88; offset += 6) {
      await page.mouse.move(x, target.y + offset);
      await page.waitForTimeout(70);
    }

    expect((await shellInfo(page))?.visible || false).toBe(false);
    await expect
      .poll(async () => (await shellInfo(page))?.visible || false)
      .toBe(true);
    await page.close();
  });

  test("yields a clicked control lock when the pointer moves to another message", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, { dwellMs: 180, actionLockMs: 1200 });
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
    await focusByHover(page, "#assistant-message-one", { waitForRect: true });
    await page
      .locator("#assistant-message-one .toolbar button")
      .first()
      .click();

    const second = await page.locator("#assistant-message-two").boundingBox();
    await page.mouse.move(
      second.x + second.width / 2,
      second.y + second.height / 2,
    );

    await expect
      .poll(async () => rectCoversElement(await shellInfo(page), second, 5))
      .toBe(true);
    await page.close();
  });

  test("choose area pins the selected message", async () => {
    const page = await context.newPage();
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
    await expect
      .poll(async () => (await extensionState(context, page))?.profile)
      .toBe("chatgpt");

    expect(
      await sendExtensionMessage(context, page, { type: "UMBRA_BEGIN_PICK" }),
    ).toEqual({ ok: true });
    const target = await page.locator("#assistant-message-two").boundingBox();
    await page.mouse.click(
      target.x + target.width / 2,
      target.y + target.height / 2,
    );

    await expect
      .poll(async () => (await extensionState(context, page))?.pinned)
      .toBe(true);
    expectRectCoversElement(await shellInfo(page), target, 5);
    await page.mouse.move(12, 12);
    await page.waitForTimeout(240);
    expectRectCoversElement(await shellInfo(page), target, 5);
    await page.close();
  });

  test("choose area prefers the explicit block under the pointer", async () => {
    const page = await context.newPage();
    await page.goto(`${server.origin}/article.html`);
    expect(
      await sendExtensionMessage(context, page, { type: "UMBRA_BEGIN_PICK" }),
    ).toEqual({ ok: true });

    const target = await page.locator("#target-article p").nth(1).boundingBox();
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
    );
    await page.waitForTimeout(80);
    await page.mouse.click(
      target.x + target.width / 2,
      target.y + target.height / 2,
    );

    await expect
      .poll(async () => (await extensionState(context, page))?.pinned)
      .toBe(true);
    const shell = await shellInfo(page);
    expectClose(shell.left, target.x - fastSettings.paddingX, 5);
    expectClose(shell.top, target.y - fastSettings.paddingY, 5);
    expectClose(shell.width, target.width + fastSettings.paddingX * 2, 5);
    expectClose(shell.height, target.height + fastSettings.paddingY * 2, 5);
    await page.close();
  });

  test("keeps the mask and outline aligned during element switching", async () => {
    const page = await context.newPage();
    await setExtensionSettings(context, { dwellMs: 120, transitionMs: 320 });
    await page.goto(`${server.chatgptOrigin}/noisy-chat-app.html`);
    await focusByHover(page, "#assistant-message-one", { waitForRect: true });
    const second = await page.locator("#assistant-message-two").boundingBox();
    await page.mouse.move(
      second.x + second.width / 2,
      second.y + second.height / 2,
    );
    await page.waitForTimeout(180);

    const shell = await shellInfo(page);
    const innerStart = shell.maskPath.match(/ZM([\d.-]+) ([\d.-]+)/);
    expect(innerStart).not.toBeNull();
    expectClose(Number(innerStart[1]), shell.left, 1);
    expectClose(
      Number(innerStart[2]),
      shell.top + Number.parseFloat(shell.borderRadius),
      1,
    );
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
