/**
 * 终端交互提示工具。
 * by AI.Coding
 */
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * 创建 readline 交互实例。
 * @returns {readline.Interface} readline 实例。
 */
export function createPrompt() {
  return readline.createInterface({ input, output });
}

/**
 * 询问文本输入。
 * @param {readline.Interface} rl readline 实例。
 * @param {string} message 提示文案。
 * @param {string} defaultValue 默认值。
 * @returns {Promise<string>} 用户输入。
 */
export async function askText(rl, message, defaultValue = "") {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await rl.question(`${message}${suffix}: `);
  return (answer.trim() || defaultValue).trim();
}

/**
 * 询问是否确认。
 * @param {readline.Interface} rl readline 实例。
 * @param {string} message 提示文案。
 * @param {boolean} defaultValue 默认值。
 * @returns {Promise<boolean>} 是否确认。
 */
export async function askConfirm(rl, message, defaultValue = true) {
  const suffix = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${message} (${suffix}): `)).trim();
  if (!answer) return defaultValue;
  return /^y(es)?$/i.test(answer);
}

/**
 * 询问单选项。
 * @param {readline.Interface} rl readline 实例。
 * @param {string} message 提示文案。
 * @param {Array<{label:string,value:string}>} choices 选项。
 * @returns {Promise<string>} 选中值。
 */
export async function askSelect(rl, message, choices) {
  console.log(message);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}`);
  });
  while (true) {
    const answer = await askText(rl, "请输入序号");
    const index = Number(answer) - 1;
    if (choices[index]) return choices[index].value;
    console.log("输入无效，请重新选择。");
  }
}

/**
 * 询问多选项。
 * @param {readline.Interface} rl readline 实例。
 * @param {string} message 提示文案。
 * @param {Array<{label:string,value:string}>} choices 选项。
 * @returns {Promise<string[]>} 选中值列表。
 */
export async function askMultiSelect(rl, message, choices) {
  console.log(message);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}`);
  });
  while (true) {
    const answer = await askText(rl, "请输入序号，多个用逗号分隔，all 表示全部", "all");
    if (answer === "all") return choices.map((choice) => choice.value);
    const indexes = answer.split(",").map((item) => Number(item.trim()) - 1);
    if (indexes.every((index) => choices[index])) return [...new Set(indexes.map((index) => choices[index].value))];
    console.log("输入无效，请重新选择。");
  }
}
