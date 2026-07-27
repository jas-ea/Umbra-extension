import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const extensionDir = path.join(repoRoot, "umbra-extension");
const distDir = path.join(repoRoot, "dist");
const manifestPath = path.join(extensionDir, "manifest.json");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function normalizePackagePath(value) {
  if (typeof value !== "string" || !value || path.isAbsolute(value)) {
    throw new Error(`Invalid package path: ${value}`);
  }
  if (/^[a-z]+:/i.test(value) || value.split(/[\\/]/).includes("..")) {
    throw new Error(`Package path must stay inside umbra-extension/: ${value}`);
  }
  return value;
}

function addFile(files, value) {
  files.add(normalizePackagePath(value));
}

function addIconMap(files, iconMap = {}) {
  for (const iconPath of Object.values(iconMap || {})) addFile(files, iconPath);
}

await run("npm", ["run", "validate"], { cwd: repoRoot });

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const version = manifest.version;
const packageDir = path.join(distDir, `umbra-${version}`);
const archivePath = path.join(distDir, `umbra-${version}.zip`);
const runtimeFiles = new Set(["manifest.json"]);

addFile(runtimeFiles, manifest.background.service_worker);
addFile(runtimeFiles, manifest.action.default_popup);
addFile(runtimeFiles, manifest.options_page);
addIconMap(runtimeFiles, manifest.icons);
addIconMap(runtimeFiles, manifest.action.default_icon);

for (const script of manifest.content_scripts || []) {
  for (const jsPath of script.js || []) addFile(runtimeFiles, jsPath);
  for (const cssPath of script.css || []) addFile(runtimeFiles, cssPath);
}

for (const filePath of [
  "popup.css",
  "popup.js",
  "options.css",
  "options.js",
  "defaults.js",
  "site-profiles.js",
]) {
  addFile(runtimeFiles, filePath);
}

await mkdir(distDir, { recursive: true });
await rm(packageDir, { recursive: true, force: true });
await rm(archivePath, { force: true });
await mkdir(packageDir, { recursive: true });

for (const relativePath of [...runtimeFiles].sort()) {
  const targetPath = path.join(packageDir, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(path.join(extensionDir, relativePath), targetPath, {
    recursive: true,
  });
}

await run("zip", ["-qry", archivePath, "."], { cwd: packageDir });

console.log(`Packaged Umbra ${version}: ${archivePath}`);
