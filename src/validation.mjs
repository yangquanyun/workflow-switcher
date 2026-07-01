/**
 * 输入校验工具。
 * by AI.Coding
 */
import { RESERVED_NAMES } from "./constants.mjs";

/**
 * 校验 source 或 target 名称，避免路径字符和命令名造成歧义。
 * @param {string} name 用户输入名称。
 * @param {string} kind 名称类型。
 * @returns {string} 校验后的名称。
 */
export function validateName(name, kind) {
  if (!name || typeof name !== "string") throw new Error(`${kind} 名称不能为空`);
  const normalized = name.trim();
  if (!normalized) throw new Error(`${kind} 名称不能为空`);
  if (RESERVED_NAMES.has(normalized)) throw new Error(`${kind} 名称不能使用保留字: ${normalized}`);
  if (/[\\/:=]/.test(normalized)) throw new Error(`${kind} 名称不能包含 /、\\、: 或 =`);
  return normalized;
}

/**
 * 解析 <名称>=<路径> 参数格式。
 * @param {string} spec 原始参数。
 * @param {string} optionName 选项名称。
 * @returns {{name:string,value:string}} 解析结果。
 */
export function parsePairSpec(spec, optionName) {
  const index = spec.indexOf("=");
  if (index <= 0) throw new Error(`${optionName} 必须使用 <名称>=<路径> 格式`);
  const name = spec.slice(0, index).trim();
  const value = spec.slice(index + 1).trim();
  if (!value) throw new Error(`${optionName} 的路径不能为空`);
  return { name, value };
}
