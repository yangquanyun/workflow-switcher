/**
 * 统一终端输出样式。
 * by AI.Coding
 */
import boxen from "boxen";
import chalk from "chalk";
import Table from "cli-table3";
import figures from "figures";
import ora from "ora";

const accent = chalk.hex("#7dd3fc");
const muted = chalk.dim;
const brand = chalk.hex("#a7f3d0");

/**
 * 判断是否应该启用动画 spinner，非 TTY 下输出稳定文本。
 * @returns {boolean} 是否启用动画。
 */
function spinnerEnabled() {
  return Boolean(process.stdout.isTTY && !process.env.CI);
}

/**
 * 输出产品标题卡片。
 * @param {string} subtitle 副标题。
 */
export function banner(subtitle = "切换团队工作流，保持 agent skills 干净可控") {
  console.log(
    boxen(`${brand.bold("Workflow Switcher")}\n${muted(subtitle)}`, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1 },
      borderColor: "cyan",
      borderStyle: "round",
    }),
  );
}

/**
 * 输出分区标题。
 * @param {string} title 分区标题。
 */
export function section(title) {
  console.log(`\n${accent.bold(title)}`);
}

/**
 * 输出成功信息。
 * @param {string} message 提示文案。
 */
export function success(message) {
  console.log(`${chalk.green(figures.tick)} ${chalk.bold(message)}`);
}

/**
 * 输出失败信息。
 * @param {string} message 提示文案。
 */
export function failure(message) {
  console.error(`${chalk.red(figures.cross)} ${chalk.bold(message)}`);
}

/**
 * 输出警告信息。
 * @param {string} message 提示文案。
 */
export function warn(message) {
  console.log(`${chalk.yellow(figures.warning)} ${message}`);
}

/**
 * 输出提示信息。
 * @param {string} message 提示文案。
 */
export function info(message) {
  console.log(`${chalk.cyan(figures.info)} ${message}`);
}

/**
 * 输出当前步骤信息。
 * @param {string} message 提示文案。
 */
export function step(message) {
  console.log(`${chalk.blue(figures.pointer)} ${chalk.bold(message)}`);
}

/**
 * 输出普通键值信息。
 * @param {string} key 键。
 * @param {string | number} value 值。
 */
export function kv(key, value) {
  console.log(`  ${muted(`${key}:`)} ${chalk.white(String(value))}`);
}

/**
 * 输出无图标的过程说明，避免交互向导中图标过密。
 * @param {string} message 提示文案。
 */
export function note(message) {
  console.log(`  ${message}`);
}

/**
 * 输出错误键值信息，和失败标题同走 stderr 保证顺序稳定。
 * @param {string} key 键。
 * @param {string | number} value 值。
 */
export function errorKv(key, value) {
  console.error(`  ${muted(`${key}:`)} ${chalk.white(String(value))}`);
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
 * 使用表格输出结构化数据。
 * @param {string[]} head 表头。
 * @param {Array<Array<string|number>>} rows 行数据。
 */
export function table(head, rows) {
  if (rows.length === 0) return;
  const output = new Table({
    head: head.map((item) => accent.bold(item)),
    style: { head: [], border: ["gray"], compact: true },
    wordWrap: true,
  });
  output.push(...rows.map((row) => row.map((item) => String(item))));
  console.log(output.toString());
}

/**
 * 输出紧凑命令清单；固定命令列宽，避免为少量帮助文本引入额外依赖。
 * @param {Array<[string,string]>} rows 命令和说明。
 */
export function commandList(rows) {
  const commandWidth = Math.max(...rows.map(([command]) => command.length), 0) + 4;
  for (const [command, description] of rows) {
    console.log(`  ${chalk.bold(command.padEnd(commandWidth))}${muted(description)}`);
  }
}

/**
 * 用 spinner 包裹同步操作，失败时会标记失败后继续抛出错误。
 * @template T
 * @param {string} text 运行中文案。
 * @param {() => T} task 同步任务。
 * @param {string} successText 成功文案。
 * @returns {T} 任务结果。
 */
export function spin(text, task, successText = text) {
  if (!spinnerEnabled()) {
    step(text);
    const result = task();
    success(successText);
    return result;
  }
  const spinner = ora({ text, color: "cyan" }).start();
  try {
    const result = task();
    spinner.succeed(successText);
    return result;
  } catch (error) {
    spinner.fail("操作未完成");
    throw error;
  }
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
