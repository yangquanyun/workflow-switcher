/**
 * 文件系统辅助函数。
 * by AI.Coding
 */
import fs from "node:fs";
import path from "node:path";

/**
 * 宽容读取 lstat，路径不存在或无权限时返回 null。
 * @param {string} filePath 文件路径。
 * @returns {fs.Stats | null} 文件状态。
 */
export function lstatMaybe(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch {
    return null;
  }
}

/**
 * 宽容读取 realpath，路径不存在或链接失效时返回 null。
 * @param {string | null} filePath 文件路径。
 * @returns {string | null} 真实路径。
 */
export function realpathMaybe(filePath) {
  if (!filePath) return null;
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

/**
 * 读取符号链接目标并转成绝对路径，便于和期望目标比较。
 * @param {string} linkPath 符号链接路径。
 * @returns {string | null} 目标绝对路径。
 */
export function linkTarget(linkPath) {
  try {
    return path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
  } catch {
    return null;
  }
}

/**
 * 原子写 JSON，避免写入中断留下半截配置。
 * @param {string} filePath 写入路径。
 * @param {unknown} payload JSON 对象。
 */
export function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

/**
 * 读取 JSON，文件不存在时返回 fallback。
 * @param {string} filePath 读取路径。
 * @param {unknown} fallback 兜底值。
 * @returns {unknown} JSON 对象。
 */
export function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

/**
 * 检查目录可写性，使用临时文件真实验证权限。
 * @param {string} dir 目录路径。
 */
export function assertWritableDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const testFile = path.join(dir, `.workflow-switcher-write-test-${process.pid}`);
  fs.writeFileSync(testFile, "ok");
  fs.unlinkSync(testFile);
}
