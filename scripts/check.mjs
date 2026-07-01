/**
 * 跨平台语法检查脚本，避免在 Windows CI 中依赖 shell glob 展开。
 * by AI.Coding
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const scanDirs = ["bin", "src", "test", "scripts"];

/**
 * 递归收集指定目录下的 mjs 文件。
 * @param {string} dir 待扫描目录。
 * @returns {string[]} mjs 文件路径。
 */
function collectMjsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectMjsFiles(fullPath));
    if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(fullPath);
  }
  return files;
}

const files = scanDirs.flatMap((dir) => collectMjsFiles(path.join(rootDir, dir)));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`语法检查通过: ${files.length} 个 .mjs 文件`);
