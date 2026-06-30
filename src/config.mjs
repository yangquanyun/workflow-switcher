/**
 * 配置读写模块。
 * by AI.Coding
 */
import { CONFIG_VERSION } from "./constants.mjs";
import { readJson, writeJson } from "./fs-utils.mjs";
import { absolutePath, configPath as defaultConfigPath } from "./paths.mjs";
import { validateName } from "./validation.mjs";

/**
 * 创建空配置；不内置任何 target 路径或 source 名称。
 * @returns {{version:number,sources:Object,targets:Object}} 空配置。
 */
export function emptyConfig() {
  return { version: CONFIG_VERSION, sources: {}, targets: {} };
}

/**
 * 标准化配置，保证路径是绝对路径并过滤非法名称。
 * @param {unknown} raw 原始配置。
 * @returns {{version:number,sources:Object,targets:Object}} 标准配置。
 */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === "object" ? raw : emptyConfig();
  const sources = {};
  for (const [name, source] of Object.entries(input.sources || {})) {
    const sourceName = validateName(name, "source");
    if (!source?.skillsDir) throw new Error(`source ${sourceName} 缺少 skillsDir`);
    // 配置落盘统一使用绝对路径，后续状态比较更稳定。
    sources[sourceName] = { skillsDir: absolutePath(source.skillsDir) };
  }

  const targets = {};
  for (const [name, target] of Object.entries(input.targets || {})) {
    const targetName = validateName(name, "target");
    if (!target?.activeDir) throw new Error(`target ${targetName} 缺少 activeDir`);
    // displayName 只是展示字段，不参与行为判断。
    targets[targetName] = {
      displayName: target.displayName || targetName,
      activeDir: absolutePath(target.activeDir),
      enabled: target.enabled !== false,
    };
  }

  return { version: CONFIG_VERSION, sources, targets };
}

/**
 * 读取配置文件，文件不存在时返回空配置。
 * @param {string} filePath 配置文件路径。
 * @returns {{version:number,sources:Object,targets:Object}} 配置。
 */
export function loadConfig(filePath = defaultConfigPath()) {
  return normalizeConfig(readJson(filePath, emptyConfig()));
}

/**
 * 保存配置文件。
 * @param {{version:number,sources:Object,targets:Object}} config 配置对象。
 * @param {string} filePath 配置文件路径。
 */
export function saveConfig(config, filePath = defaultConfigPath()) {
  writeJson(filePath, normalizeConfig(config));
}

/**
 * 新增或更新 source。
 * @param {object} config 配置对象。
 * @param {string} name source 名称。
 * @param {string} skillsDir skills 根目录。
 * @returns {object} 更新后的配置。
 */
export function setSource(config, name, skillsDir) {
  const next = normalizeConfig(config);
  const sourceName = validateName(name, "source");
  next.sources[sourceName] = { skillsDir: absolutePath(skillsDir) };
  return next;
}

/**
 * 新增或更新 target。
 * @param {object} config 配置对象。
 * @param {string} name target 名称。
 * @param {string} activeDir active skills 目录。
 * @param {string} displayName 展示名称。
 * @returns {object} 更新后的配置。
 */
export function setTarget(config, name, activeDir, displayName = null) {
  const next = normalizeConfig(config);
  const targetName = validateName(name, "target");
  next.targets[targetName] = {
    displayName: displayName || next.targets[targetName]?.displayName || targetName,
    activeDir: absolutePath(activeDir),
    enabled: true,
  };
  return next;
}

/**
 * 删除 source 配置，不删除源目录。
 * @param {object} config 配置对象。
 * @param {string} name source 名称。
 * @returns {object} 更新后的配置。
 */
export function removeSource(config, name) {
  const next = normalizeConfig(config);
  delete next.sources[validateName(name, "source")];
  return next;
}

/**
 * 删除 target 配置，不删除 active skills 目录。
 * @param {object} config 配置对象。
 * @param {string} name target 名称。
 * @returns {object} 更新后的配置。
 */
export function removeTarget(config, name) {
  const next = normalizeConfig(config);
  delete next.targets[validateName(name, "target")];
  return next;
}
