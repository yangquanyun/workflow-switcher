/**
 * 统一终端输出样式。
 * by AI.Coding
 */
import chalk from "chalk";

/**
 * 输出成功信息。
 * @param {string} message 提示文案。
 */
export function success(message) {
  console.log(`${chalk.green("✓")} ${chalk.bold(message)}`);
}

/**
 * 输出失败信息。
 * @param {string} message 提示文案。
 */
export function failure(message) {
  console.error(`${chalk.red("✗")} ${chalk.bold(message)}`);
}

/**
 * 输出警告信息。
 * @param {string} message 提示文案。
 */
export function warn(message) {
  console.log(`${chalk.yellow("⚠")} ${message}`);
}

/**
 * 输出提示信息。
 * @param {string} message 提示文案。
 */
export function info(message) {
  console.log(`${chalk.cyan("ℹ")} ${message}`);
}

/**
 * 输出当前步骤信息。
 * @param {string} message 提示文案。
 */
export function step(message) {
  console.log(`${chalk.blue("→")} ${chalk.bold(message)}`);
}

/**
 * 输出普通键值信息。
 * @param {string} key 键。
 * @param {string | number} value 值。
 */
export function kv(key, value) {
  console.log(`  ${chalk.dim(`${key}:`)} ${chalk.white(String(value))}`);
}

/**
 * 输出错误键值信息，和失败标题同走 stderr 保证顺序稳定。
 * @param {string} key 键。
 * @param {string | number} value 值。
 */
export function errorKv(key, value) {
  console.error(`  ${chalk.dim(`${key}:`)} ${chalk.white(String(value))}`);
}

/**
 * 高亮路径。
 * @param {string} value 路径文本。
 * @returns {string} 彩色路径。
 */
export function pathText(value) {
  return chalk.cyan(value);
}

/**
 * 高亮名称。
 * @param {string} value 名称文本。
 * @returns {string} 彩色名称。
 */
export function nameText(value) {
  return chalk.bold(value);
}

/**
 * 根据错误内容输出处理建议。
 * @param {Error} error 错误对象。
 */
export function printResolution(error) {
  const message = error?.message || "";
  if (/符号链接|symlink|symbolic/i.test(message)) {
    warn("处理方式: Windows 请开启 Developer Mode，或让管理员授予 Create symbolic links 权限，或以管理员身份运行终端。");
    return;
  }
  if (/不存在/.test(message)) {
    warn("处理方式: 检查输入路径是否正确；如果目录已移动，请重新执行 source add 或 target add 更新配置。");
    return;
  }
  if (/不是本工具受控项|仍然存在|已存在/.test(message)) {
    warn("处理方式: 目标目录存在同名非受控条目，请先手动备份、删除或更名后再重试。");
    return;
  }
  if (/未配置|未知 source|未知 target/.test(message)) {
    warn("处理方式: 先执行 workflow-switcher setup，或使用 source add / target add 补充配置后重试。");
    return;
  }
  if (/不支持交互选择/.test(message)) {
    warn("处理方式: 请在可交互的真实终端中执行 workflow-switcher setup，不要通过管道或后台任务运行。");
    return;
  }
  if (/用户取消/.test(message)) {
    warn("处理方式: 如需继续配置，请重新执行 workflow-switcher setup。");
    return;
  }
  warn("处理方式: 可执行 workflow-switcher doctor 查看配置、路径和 symlink 权限状态。");
}
