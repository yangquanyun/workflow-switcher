/**
 * 终端交互提示工具。
 * by AI.Coding
 */
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { warn } from "./output.mjs";

/**
 * 保留空上下文对象，兼容调用方原有参数位置。
 * @returns {object} 交互上下文。
 */
export function createPrompt() {
  return {};
}

/**
 * 关闭交互上下文；inquirer 无需显式关闭，这里保留空函数便于旧调用点复用。
 * @param {object} _prompt 交互上下文。
 */
export function closePrompt(_prompt) {
  // @inquirer/prompts 每次调用自行管理输入输出，无需手动释放资源。
}

/**
 * 询问文本输入，空值且无默认值时原地重问。
 * @param {object} _prompt 交互上下文。
 * @param {string} message 提示文案。
 * @param {string} defaultValue 默认值。
 * @returns {Promise<string>} 用户输入。
 */
export async function askText(_prompt, message, defaultValue = "") {
  return input({
    message,
    default: defaultValue || undefined,
    validate: (value) => {
      if ((value || defaultValue).trim()) return true;
      return "输入不能为空";
    },
  }).then((value) => (value.trim() || defaultValue).trim());
}

/**
 * 询问是否确认。
 * @param {object} _prompt 交互上下文。
 * @param {string} message 提示文案。
 * @param {boolean} defaultValue 默认值。
 * @returns {Promise<boolean>} 是否确认。
 */
export async function askConfirm(_prompt, message, defaultValue = true) {
  return confirm({ message, default: defaultValue });
}

/**
 * 询问单选项，支持方向键选择和回车确认。
 * @param {object} _prompt 交互上下文。
 * @param {string} message 提示文案。
 * @param {Array<{label:string,value:string}>} choices 选项。
 * @returns {Promise<string>} 选中值。
 */
export async function askSelect(_prompt, message, choices) {
  if (choices.length === 0) {
    warn("没有可选择的选项。");
    return null;
  }
  return select({
    message,
    choices: choices.map((choice) => ({ name: choice.label, value: choice.value })),
  });
}

/**
 * 询问多选项，支持空格勾选、回车确认。
 * @param {object} _prompt 交互上下文。
 * @param {string} message 提示文案。
 * @param {Array<{label:string,value:string}>} choices 选项。
 * @returns {Promise<string[]>} 选中值列表。
 */
export async function askMultiSelect(_prompt, message, choices) {
  if (choices.length === 0) {
    warn("没有可选择的选项。");
    return [];
  }
  return checkbox({
    message,
    choices: choices.map((choice) => ({ name: choice.label, value: choice.value, checked: true })),
    validate: (answer) => (answer.length > 0 ? true : "请至少选择一项"),
  });
}
