import { readFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const REQUIRED_PUBLIC_FILES = new Set([
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  ".env.example",
]);
const MAX_SCAN_BYTES = 1024 * 1024;
const CREDENTIAL_ASSIGNMENT = /^[ \t]*(?:export[ \t]+)?(PERXONA_CONNECT_SECRET_KEY|VITE_PERXONA_CONNECT_PUBLISHABLE_KEY)[ \t]*=[ \t]*(.*?)[ \t]*$/gm;

const forbiddenPathRule = (file) => {
  if ((file === ".env" || file.startsWith(".env.")) && file !== ".env.example") return "不得追蹤環境設定檔";
  if (/(^|\/)\.DS_Store$/.test(file)) return "不得追蹤 .DS_Store";
  if (/(^|\/)\.superpowers(\/|$)/.test(file)) return "不得追蹤 .superpowers";
  if (/(^|\/)(node_modules|dist)(\/|$)/.test(file)) return "不得追蹤 build 或 dependency 產物";
  if (/\.(pem|key)$/i.test(file)) return "不得追蹤憑證檔";
  return null;
};

export function validateTrackedFiles(entries) {
  const errors = [];
  const tracked = new Set();

  for (const [file, content] of entries) {
    tracked.add(file);
    const pathRule = forbiddenPathRule(file);
    if (pathRule) errors.push(`${file}: ${pathRule}`);
    if (content === null || content === undefined) continue;

    const text = Buffer.isBuffer(content) ? content.toString("utf8") : String(content);
    for (const match of text.matchAll(CREDENTIAL_ASSIGNMENT)) {
      if (match[2].trim() !== "") errors.push(`${file}: ${match[1]} 必須維持空白 assignment`);
    }
  }

  for (const required of REQUIRED_PUBLIC_FILES) {
    if (!tracked.has(required)) errors.push(`${required}: 缺少必要公開文件`);
  }
  return [...new Set(errors)];
}

function command(command, args) {
  const result = spawnSync(command, args, { encoding: "buffer" });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function main() {
  const root = command("git", ["rev-parse", "--show-toplevel"]);
  const files = command("git", ["ls-files", "-z"]);
  if (!root || !files) {
    console.error("release gate：無法讀取 Git tracked files");
    process.exitCode = 1;
    return;
  }

  const projectRoot = root.toString("utf8").trim();
  const entries = files.toString("utf8").split("\0").filter(Boolean).flatMap((file) => {
    try {
      const stat = lstatSync(resolve(projectRoot, file));
      if (!stat.isFile()) return [[file, null]];
      if (stat.size > MAX_SCAN_BYTES) return [[file, null]];
      const content = readFileSync(resolve(projectRoot, file));
      return [[file, content.includes(0) ? null : content]];
    } catch {
      return [[file, null]];
    }
  });
  const errors = validateTrackedFiles(entries);
  for (const error of errors) console.error(`release gate：${error}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (import.meta.main) main();
