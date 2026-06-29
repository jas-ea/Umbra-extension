import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const extensionDir = path.join(repoRoot, "umbra-extension");
const manifestPath = path.join(extensionDir, "manifest.json");
const errors = [];

function record(message) {
  errors.push(message);
}

function assert(condition, message) {
  if (!condition) record(message);
}

function isLocalPath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/^[a-z]+:/i.test(value) &&
    !path.isAbsolute(value)
  );
}

async function fileExists(relativePath, label) {
  if (!isLocalPath(relativePath)) {
    record(`${label} must be a local package path: ${relativePath}`);
    return;
  }

  const absolutePath = path.resolve(extensionDir, relativePath);
  if (!absolutePath.startsWith(`${extensionDir}${path.sep}`)) {
    record(`${label} must stay inside umbra-extension/: ${relativePath}`);
    return;
  }

  try {
    await access(absolutePath);
  } catch {
    record(`${label} references a missing file: ${relativePath}`);
  }
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    record(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

function eachFile(value, label) {
  if (!value) return [];
  if (Array.isArray(value))
    return value.map((item, index) => [item, `${label}[${index}]`]);
  if (typeof value === "object")
    return Object.entries(value).map(([key, item]) => [
      item,
      `${label}.${key}`,
    ]);
  record(`${label} must be an array or object of package paths`);
  return [];
}

const manifest = await readJson(manifestPath, "manifest.json");

if (manifest) {
  assert(
    manifest.manifest_version === 3,
    "manifest_version must be 3 for Chrome MV3",
  );
  assert(
    typeof manifest.name === "string" && manifest.name.trim(),
    "manifest.name is required",
  );
  assert(
    typeof manifest.version === "string" && manifest.version.trim(),
    "manifest.version is required",
  );
  assert(
    typeof manifest.description === "string" && manifest.description.trim(),
    "manifest.description is required",
  );
  assert(
    !manifest.background?.scripts,
    "Chrome MV3 must use background.service_worker, not background.scripts",
  );

  await fileExists(
    manifest.background?.service_worker,
    "background.service_worker",
  );
  await fileExists(manifest.action?.default_popup, "action.default_popup");
  await fileExists(manifest.options_page, "options_page");

  for (const [iconPath, label] of eachFile(manifest.icons, "icons")) {
    await fileExists(iconPath, label);
  }

  for (const [iconPath, label] of eachFile(
    manifest.action?.default_icon,
    "action.default_icon",
  )) {
    await fileExists(iconPath, label);
  }

  assert(
    Array.isArray(manifest.content_scripts) &&
      manifest.content_scripts.length > 0,
    "content_scripts must be present",
  );
  for (const [scriptIndex, script] of (
    manifest.content_scripts || []
  ).entries()) {
    assert(
      Array.isArray(script.matches) && script.matches.length > 0,
      `content_scripts[${scriptIndex}].matches is required`,
    );
    for (const [jsPath, label] of eachFile(
      script.js,
      `content_scripts[${scriptIndex}].js`,
    )) {
      await fileExists(jsPath, label);
    }
    for (const [cssPath, label] of eachFile(
      script.css,
      `content_scripts[${scriptIndex}].css`,
    )) {
      await fileExists(cssPath, label);
    }
  }

  for (const [command, config] of Object.entries(manifest.commands || {})) {
    assert(
      typeof config.description === "string" && config.description.trim(),
      `commands.${command}.description is required`,
    );
  }

  for (const [index, permission] of (manifest.permissions || []).entries()) {
    assert(
      typeof permission === "string" && permission.trim(),
      `permissions[${index}] must be a non-empty string`,
    );
  }

  for (const [index, hostPermission] of (
    manifest.host_permissions || []
  ).entries()) {
    assert(
      typeof hostPermission === "string" && hostPermission.trim(),
      `host_permissions[${index}] must be a non-empty string`,
    );
  }
}

if (errors.length) {
  console.error("Extension validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Chrome MV3 manifest validation passed for umbra-extension/.");
