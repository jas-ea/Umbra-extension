/* global document */
import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionPath = path.join(repoRoot, "umbra-extension");
const outputPath = path.join(repoRoot, "launch/assets/screenshots");

const captures = [
  {
    name: "chrome-developers-permissions.png",
    url: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions",
    selector: "main p",
    index: 2,
  },
  {
    name: "wikipedia-cassini.png",
    url: "https://en.wikipedia.org/wiki/Cassini%E2%80%93Huygens",
    selector: ".mw-parser-output section > p",
    index: 1,
    useTextBounds: true,
  },
  {
    name: "github-openai-cookbook-issues.png",
    url: "https://github.com/openai/openai-cookbook/issues",
    selector: 'main [role="listitem"]',
    index: 1,
    pointX: 0.7,
  },
  {
    name: "stackoverflow-questions.png",
    url: "https://stackoverflow.com/questions",
    selector: "#questions .s-post-summary",
    index: 1,
    dismiss: ["Necessary cookies only"],
  },
];

async function spotlightRect(page) {
  return page.evaluate(() => {
    // This function runs in the captured page, not in Node.
    const host = document.getElementById("umbra-overlay-host");
    const shell = host?.shadowRoot?.querySelector(".shell");
    const mask = host?.shadowRoot?.querySelector(".mask");
    if (!shell || !shell.classList.contains("visible")) return null;
    if (!mask?.classList.contains("visible")) return null;
    const rect = shell.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });
}

function spotlightCoversTarget(spotlight, target, tolerance = 5) {
  return (
    spotlight.left <= target.x + tolerance &&
    spotlight.top <= target.y + tolerance &&
    spotlight.left + spotlight.width >= target.x + target.width - tolerance &&
    spotlight.top + spotlight.height >= target.y + target.height - tolerance
  );
}

async function waitForSpotlight(page, target) {
  const deadline = Date.now() + 6000;
  let lastRect = null;
  while (Date.now() < deadline) {
    const rect = await spotlightRect(page);
    lastRect = rect;
    if (
      rect?.width > 40 &&
      rect?.height > 24 &&
      spotlightCoversTarget(rect, target)
    ) {
      return rect;
    }
    await page.waitForTimeout(100);
  }
  const diagnostics = await page.evaluate((targetRect) => {
    const host = document.getElementById("umbra-overlay-host");
    const shell = host?.shadowRoot?.querySelector(".shell");
    const mask = host?.shadowRoot?.querySelector(".mask");
    const point = {
      x: Math.round(targetRect.x + targetRect.width / 2),
      y: Math.round(targetRect.y + targetRect.height / 2),
    };
    const underPoint = document.elementFromPoint(point.x, point.y);
    return {
      hasOverlay: !!host,
      shellVisible: shell?.classList.contains("visible") || false,
      maskVisible: mask?.classList.contains("visible") || false,
      centerTag: underPoint?.tagName || "",
      centerRole: underPoint?.getAttribute?.("role") || "",
    };
  }, target);
  throw new Error(
    `Umbra did not focus the intended block on ${page.url()}: ${JSON.stringify({ target, lastRect, diagnostics })}`,
  );
}

async function dismissKnownPrompts(page, labels = []) {
  for (const label of labels) {
    const control = page
      .getByRole("button", { name: label, exact: true })
      .or(page.getByText(label, { exact: true }))
      .first();
    const visible = await control
      .waitFor({ state: "visible", timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await control.click();
      await control.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
    }
  }
}

await mkdir(outputPath, { recursive: true });
for (const [captureIndex, capture] of captures.entries()) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const profilePath = await mkdtemp(
      path.join(os.tmpdir(), `umbra-live-${captureIndex}-`),
    );
    const context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--disable-features=PasswordManagerOnboarding,SigninIntercept",
      ],
    });

    try {
      const page = await context.newPage();
      await page.goto(capture.url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForTimeout(2200);
      await dismissKnownPrompts(page, capture.dismiss);

      const target = page.locator(capture.selector).nth(capture.index || 0);
      await target.scrollIntoViewIfNeeded();
      let box = await target.boundingBox();
      if (!box) throw new Error(`Target is not visible: ${capture.selector}`);
      if (capture.useTextBounds) {
        box = await target.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rect = range.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        });
      }

      await page.mouse.move(4, 4);
      await page.waitForTimeout(120);
      await page.mouse.move(
        box.x + box.width * (capture.pointX || 0.5),
        box.y + box.height / 2,
      );
      await waitForSpotlight(page, box);
      await page.waitForTimeout(220);
      await page.screenshot({ path: path.join(outputPath, capture.name) });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    } finally {
      await context.close();
      await rm(profilePath, { recursive: true, force: true });
    }
  }
  if (lastError) throw lastError;
}
