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
 * 标准化忽略 skill 名称列表，保证配置稳定且不保留空值。
 * @param {unknown} input 原始忽略列表。
 * @returns {string[]} 规范化后的 skill 名称列表。
 */
export function normalizeIgnoredSkills(input) {
  if (!Array.isArray(input)) return [];
  const names = input
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(names)].sort();
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
    // 配置落盘统一使用绝对路径，忽略列表只按 skill name 精确匹配。
    sources[sourceName] = {
      skillsDir: absolutePath(source.skillsDir),
      ignoredSkills: normalizeIgnoredSkills(source.ignoredSkills),
    };
  }

  const targets = {};
  for (const [name, target] of Object.entries(input.targets || {})) {
    const targetName = validateName(name, "target");
    if (!target?.activeDir) throw new Error(`target ${targetName} 缺少 activeDir`);
    targets[targetName] = {
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
  const current = next.sources[sourceName] || {};
  next.sources[sourceName] = {
    skillsDir: absolutePath(skillsDir),
    ignoredSkills: current.ignoredSkills || [],
  };
  return next;
}

/**
 * 覆盖指定 source 的忽略 skill 列表。
 * @param {object} config 配置对象。
 * @param {string} name source 名称。
 * @param {string[]} ignoredSkills 忽略的 skill 名称列表。
 * @returns {object} 更新后的配置。
 */
export function setIgnoredSkills(config, name, ignoredSkills) {
  const next = normalizeConfig(config);
  const sourceName = validateName(name, "source");
  if (!next.sources[sourceName]) throw new Error(`未知 source: ${sourceName}`);
  next.sources[sourceName] = {
    ...next.sources[sourceName],
    ignoredSkills: normalizeIgnoredSkills(ignoredSkills),
  };
  return next;
}

/**
 * 向指定 source 添加忽略 skill。
 * @param {object} config 配置对象。
 * @param {string} name source 名称。
 * @param {string[]} skillNames skill 名称列表。
 * @returns {object} 更新后的配置。
 */
export function addIgnoredSkills(config, name, skillNames) {
  const next = normalizeConfig(config);
  const sourceName = validateName(name, "source");
  if (!next.sources[sourceName]) throw new Error(`未知 source: ${sourceName}`);
  return setIgnoredSkills(next, sourceName, [...next.sources[sourceName].ignoredSkills, ...skillNames]);
}

/**
 * 从指定 source 移除忽略 skill，让后续 use 重新投影这些 skill。
 * @param {object} config 配置对象。
 * @param {string} name source 名称。
 * @param {string[]} skillNames skill 名称列表。
 * @returns {object} 更新后的配置。
 */
export function removeIgnoredSkills(config, name, skillNames) {
  const next = normalizeConfig(config);
  const sourceName = validateName(name, "source");
  if (!next.sources[sourceName]) throw new Error(`未知 source: ${sourceName}`);
  const removing = new Set(normalizeIgnoredSkills(skillNames));
  return setIgnoredSkills(
    next,
    sourceName,
    next.sources[sourceName].ignoredSkills.filter((skillName) => !removing.has(skillName)),
  );
}

/**
 * 新增或更新 target。
 * @param {object} config 配置对象。
 * @param {string} name target 名称。
 * @param {string} activeDir active skills 目录。
 * @returns {object} 更新后的配置。
 */
export function setTarget(config, name, activeDir) {
  const next = normalizeConfig(config);
  const targetName = validateName(name, "target");
  next.targets[targetName] = {
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
