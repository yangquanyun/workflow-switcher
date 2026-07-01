/**
 * 路径处理工具。
 * by AI.Coding
 */
import os from "node:os";
import path from "node:path";

/**
 * 展开用户目录符号，保证 macOS 和 Windows 都能识别用户输入的 ~。
 * @param {string} input 用户输入路径。
 * @returns {string} 展开后的路径。
 */
export function expandHome(input) {
  if (!input || typeof input !== "string") return input;
  if (input === "~") return os.homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    // path.join 会按当前平台生成正确分隔符。
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

/**
 * 转成绝对路径，避免状态文件中保存相对路径导致后续无法定位。
 * @param {string} input 用户输入路径。
 * @returns {string} 绝对路径。
 */
export function absolutePath(input) {
  return path.resolve(expandHome(input));
}

/**
 * 获取配置文件路径；环境变量只作为高级覆盖入口，不内置任何 target 路径。
 * @returns {string} 配置文件路径。
 */
export function configPath() {
  return absolutePath(process.env.WORKFLOW_SWITCHER_CONFIG || "~/.config/workflow-switcher/config.json");
}

/**
 * 判断 child 是否位于 parent 内部，用于安全校验受控链接归属。
 * @param {string} child 子路径。
 * @param {string} parent 父路径。
 * @returns {boolean} 是否位于父路径内部。
 */
export function isInsidePath(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
