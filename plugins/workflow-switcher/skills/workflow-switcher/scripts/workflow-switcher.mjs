#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";

const CONFIG_VERSION = 2;
const STATE_FILE = ".workflow-switcher.json";
const VALID_LINK_STRATEGIES = new Set(["auto", "symlink", "junction", "copy"]);
const VALID_ROOT_ENTRY_MODES = new Set(["auto", "manual", "none"]);
const RESERVED_COMMANDS = new Set(["init", "status", "switch", "use", "discover", "profiles", "help"]);
// 这些标记用于识别 ai-toolkit 这类共享工作流根目录，避免要求用户手动维护 --root-entry。
const AUTO_ROOT_MARKERS = [
  "WORKFLOW.md",
  "WORKFLOW-DETAILS.md",
  "TEMPLATE-STANDARD.md",
  ".best-practices",
  ".scripts",
  "templates",
];
const AUTO_ROOT_OPTIONAL_ENTRIES = ["README.md", ...AUTO_ROOT_MARKERS];

const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  linkStrategy: "auto",
  profiles: {},
  targets: {
    codex: {
      activeDir: "~/.codex/skills",
      enabled: true,
    },
    claude: {
      activeDir: "~/.claude/skills",
      enabled: false,
    },
  },
};

// 展开用户目录，兼容 macOS/Linux/Windows 上的 Node.js 路径处理。
function expandHome(input) {
  if (!input || typeof input !== "string") return input;
  if (input === "~") return os.homedir();
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

// 统一转成绝对路径，避免状态文件里出现相对路径导致后续无法判断归属。
function absolutePath(input) {
  return path.resolve(expandHome(input));
}

// 配置文件默认放在用户目录；插件源码里不内置任何团队 skills 路径。
function configPath() {
  return expandHome(process.env.WORKFLOW_SWITCHER_CONFIG || "~/.config/workflow-switcher/config.json");
}

function statePath(activeDir) {
  return path.join(activeDir, STATE_FILE);
}

function usage(exitCode = 0) {
  const text = `
workflow-switcher <命令> [选项]

命令:
  init                         初始化或更新本机配置
  status                       查看当前 target 的分类、受控项和未受控项
  switch <分类>                切换到指定分类的 skills
  use <分类>                   switch 的别名
  discover [分类]              查看一个或全部分类中发现的 skills
  profiles                     查看已配置分类和 target
  help                         显示帮助

通用选项:
  --config <路径>              使用指定配置文件
  --target <名称>              操作目标: codex、claude、其他自定义 target 或 all，默认 codex
  --dry-run                    只预览文件系统变更，不实际修改
  --force                      替换阻塞切换的既有符号链接

init 选项:
  --profile <分类>=<路径>      增加或更新一个 skills 分类，可重复
  --root-mode <分类>=<模式>    根附属项模式: auto、manual 或 none
  --root-entry <分类>:<名称>   手动增加根目录附属项，可重复
  --clear-root-entries <分类>  清空手动根附属项
  --target-path <名称>=<路径>  增加或更新一个 agent target，可重复
  --enable-target <名称>       启用 target，可重复
  --disable-target <名称>      禁用 target，可重复
  --link-strategy <策略>       auto、symlink、junction 或 copy
  --interactive                交互式填写配置

示例:
  workflow-switcher init --profile V5=/repo/seeyon-new/ai-toolkit/skills --profile ZW=/repo/1st/ai-toolkit/skills
  workflow-switcher init --root-mode V5=auto --target-path claude=~/.claude/skills --enable-target claude
  workflow-switcher switch V5 --target codex --dry-run --force
  workflow-switcher switch ZW --target all --force
`;
  console.log(text.trim());
  process.exit(exitCode);
}

function takeValue(args, arg, optionName) {
  if (arg.includes("=")) return arg.slice(arg.indexOf("=") + 1);
  const value = args.shift();
  if (!value) throw new Error(`${optionName} 需要一个值`);
  return value;
}

// 解析命令行参数，只做语法拆分，不在这里读取文件系统；通用选项允许放在命令前后。
function parseArgs(argv) {
  const args = [...argv];
  const result = {
    command: null,
    rest: [],
    config: null,
    target: "codex",
    dryRun: false,
    force: false,
    profileSpecs: [],
    rootEntrySpecs: [],
    rootModeSpecs: [],
    clearRootEntryProfiles: [],
    targetPathSpecs: [],
    enableTargets: [],
    disableTargets: [],
    linkStrategy: null,
    interactive: false,
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--force") result.force = true;
    else if (arg === "--interactive") result.interactive = true;
    else if (arg === "--help" || arg === "-h") result.command = arg;
    else if (arg === "--config" || arg.startsWith("--config=")) result.config = takeValue(args, arg, "--config");
    else if (arg === "--target" || arg.startsWith("--target=")) result.target = takeValue(args, arg, "--target");
    else if (arg === "--profile" || arg.startsWith("--profile=")) result.profileSpecs.push(takeValue(args, arg, "--profile"));
    else if (arg === "--root-mode" || arg.startsWith("--root-mode=")) result.rootModeSpecs.push(takeValue(args, arg, "--root-mode"));
    else if (arg === "--root-entry" || arg.startsWith("--root-entry=")) result.rootEntrySpecs.push(takeValue(args, arg, "--root-entry"));
    else if (arg === "--clear-root-entries" || arg.startsWith("--clear-root-entries=")) result.clearRootEntryProfiles.push(takeValue(args, arg, "--clear-root-entries"));
    else if (arg === "--target-path" || arg.startsWith("--target-path=")) result.targetPathSpecs.push(takeValue(args, arg, "--target-path"));
    else if (arg === "--enable-target" || arg.startsWith("--enable-target=")) result.enableTargets.push(takeValue(args, arg, "--enable-target"));
    else if (arg === "--disable-target" || arg.startsWith("--disable-target=")) result.disableTargets.push(takeValue(args, arg, "--disable-target"));
    else if (arg === "--link-strategy" || arg.startsWith("--link-strategy=")) result.linkStrategy = takeValue(args, arg, "--link-strategy");
    else if (arg === "--codex-active-dir" || arg.startsWith("--codex-active-dir=")) result.targetPathSpecs.push(`codex=${takeValue(args, arg, "--codex-active-dir")}`);
    else if (arg === "--claude-active-dir" || arg.startsWith("--claude-active-dir=")) result.targetPathSpecs.push(`claude=${takeValue(args, arg, "--claude-active-dir")}`);
    else if (arg === "--enable-claude") result.enableTargets.push("claude");
    else if (arg === "--disable-claude") result.disableTargets.push("claude");
    else if (!result.command) result.command = arg;
    else result.rest.push(arg);
  }

  result.command ||= "help";
  return result;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function writeJson(filePath, payload, { dryRun = false } = {}) {
  if (dryRun) {
    console.log(`[dry-run] 写入 ${filePath}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

function lstatMaybe(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch {
    return null;
  }
}

function validateName(name, kind) {
  if (!name || typeof name !== "string") throw new Error(`${kind} 名称不能为空`);
  if (name === "all") throw new Error(`${kind} 名称不能是 all`);
  if (/[\\/:=]/.test(name)) throw new Error(`${kind} 名称不能包含 /、\\、: 或 =`);
  return name;
}

function validateProfileName(name) {
  if (RESERVED_COMMANDS.has(name)) throw new Error(`分类名称不能使用保留命令: ${name}`);
  return validateName(name, "分类");
}

function parsePairSpec(spec, optionName) {
  const index = spec.indexOf("=");
  if (index <= 0) throw new Error(`${optionName} 必须使用 <名称>=<路径> 格式`);
  return {
    name: spec.slice(0, index).trim(),
    value: spec.slice(index + 1).trim(),
  };
}

function parseRootEntrySpec(spec) {
  const index = spec.indexOf(":");
  if (index <= 0) throw new Error("--root-entry 必须使用 <分类>:<名称> 格式");
  const profileName = spec.slice(0, index).trim();
  const entryName = spec.slice(index + 1).trim();
  if (!entryName) throw new Error("--root-entry 的名称不能为空");
  if (path.isAbsolute(entryName) || entryName.includes("..")) {
    throw new Error("--root-entry 只能是分类根目录下的相对路径");
  }
  return { profileName, entryName };
}

function normalizeProfile(name, rawProfile) {
  const skillsPath = typeof rawProfile === "string" ? rawProfile : rawProfile?.skillsPath || rawProfile?.path;
  if (!skillsPath) throw new Error(`分类 ${name} 缺少 skillsPath`);
  const rootEntries = Array.isArray(rawProfile?.rootEntries) ? [...rawProfile.rootEntries] : null;
  const rootEntriesMode = rawProfile?.rootEntriesMode || (rootEntries ? "manual" : "auto");
  if (!VALID_ROOT_ENTRY_MODES.has(rootEntriesMode)) {
    throw new Error(`分类 ${name} 的 rootEntriesMode 无效: ${rootEntriesMode}`);
  }
  return {
    skillsPath: absolutePath(skillsPath),
    rootEntries,
    rootEntriesMode,
  };
}

function normalizeTarget(name, rawTarget, fallbackOverride = null) {
  const fallback = DEFAULT_CONFIG.targets[name] || { activeDir: `~/.${name}/skills`, enabled: false };
  return {
    activeDir: absolutePath(rawTarget?.activeDir || fallbackOverride?.activeDir || fallback.activeDir),
    enabled: typeof rawTarget?.enabled === "boolean" ? rawTarget.enabled : typeof fallbackOverride?.enabled === "boolean" ? fallbackOverride.enabled : Boolean(fallback.enabled),
  };
}

// 兼容读取旧版 sources 配置，但新版写回时统一使用 profiles。
function normalizeConfig(rawConfig) {
  const raw = rawConfig || DEFAULT_CONFIG;
  const profilesInput = raw.profiles && typeof raw.profiles === "object" ? raw.profiles : raw.sources || {};
  const profiles = {};
  for (const [name, rawProfile] of Object.entries(profilesInput)) {
    profiles[validateProfileName(name)] = normalizeProfile(name, rawProfile);
  }

  const rawTargets = raw.targets && typeof raw.targets === "object" ? raw.targets : {};
  const targetNames = new Set(["codex", "claude", ...Object.keys(rawTargets)]);
  const targets = {};
  for (const name of targetNames) {
    targets[validateName(name, "target")] = normalizeTarget(
      name,
      rawTargets[name],
      name === "codex" && raw.activeDir ? { activeDir: raw.activeDir, enabled: true } : undefined,
    );
  }

  const linkStrategy = raw.linkStrategy || DEFAULT_CONFIG.linkStrategy;
  if (!VALID_LINK_STRATEGIES.has(linkStrategy)) throw new Error(`无效链接策略: ${linkStrategy}`);

  return {
    version: CONFIG_VERSION,
    linkStrategy,
    profiles,
    targets,
  };
}

function loadConfig(filePath) {
  return normalizeConfig(readJson(filePath, DEFAULT_CONFIG));
}

function ensureProfile(config, name) {
  const profileName = validateProfileName(name);
  if (!config.profiles[profileName]) {
    config.profiles[profileName] = { skillsPath: "", rootEntries: null, rootEntriesMode: "auto" };
  }
  return config.profiles[profileName];
}

function applyArgOverrides(config, args) {
  const next = structuredClone(config);

  for (const spec of args.profileSpecs) {
    const { name, value } = parsePairSpec(spec, "--profile");
    const profileName = validateProfileName(name);
    next.profiles[profileName] = {
      ...(next.profiles[profileName] || {}),
      skillsPath: absolutePath(value),
      rootEntries: next.profiles[profileName]?.rootEntries ?? null,
      rootEntriesMode: next.profiles[profileName]?.rootEntriesMode || "auto",
    };
  }

  for (const spec of args.rootModeSpecs) {
    const { name, value } = parsePairSpec(spec, "--root-mode");
    if (!VALID_ROOT_ENTRY_MODES.has(value)) throw new Error(`无效根附属项模式: ${value}`);
    const profile = ensureProfile(next, name);
    profile.rootEntriesMode = value;
    if (value !== "manual") profile.rootEntries = null;
  }

  for (const profileName of args.clearRootEntryProfiles) {
    const profile = ensureProfile(next, profileName);
    profile.rootEntries = [];
    profile.rootEntriesMode = "manual";
  }

  for (const spec of args.rootEntrySpecs) {
    const { profileName, entryName } = parseRootEntrySpec(spec);
    const profile = ensureProfile(next, profileName);
    profile.rootEntriesMode = "manual";
    if (!Array.isArray(profile.rootEntries)) profile.rootEntries = [];
    if (!profile.rootEntries.includes(entryName)) profile.rootEntries.push(entryName);
  }

  for (const spec of args.targetPathSpecs) {
    const { name, value } = parsePairSpec(spec, "--target-path");
    const targetName = validateName(name, "target");
    next.targets[targetName] = {
      ...(next.targets[targetName] || {}),
      activeDir: absolutePath(value),
      enabled: true,
    };
  }

  for (const name of args.enableTargets) {
    const targetName = validateName(name, "target");
    next.targets[targetName] = normalizeTarget(targetName, { ...(next.targets[targetName] || {}), enabled: true });
  }

  for (const name of args.disableTargets) {
    const targetName = validateName(name, "target");
    next.targets[targetName] = normalizeTarget(targetName, { ...(next.targets[targetName] || {}), enabled: false });
  }

  if (args.linkStrategy) next.linkStrategy = args.linkStrategy;
  return normalizeConfig(next);
}

async function applyInteractiveOverrides(config) {
  if (!process.stdin.isTTY) {
    throw new Error("当前终端不支持交互式初始化，请改用 init 参数传入分类和路径");
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, defaultValue = "") => {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    const answer = await rl.question(`${label}${suffix}: `);
    return answer.trim() || defaultValue;
  };

  try {
    const next = structuredClone(config);
    let keepAdding = true;
    while (keepAdding) {
      const profileName = await ask("分类名称，例如 V5、ZW、project-a");
      if (profileName) {
        const skillsPath = await ask(`${profileName} 的 skills 路径`);
        next.profiles[validateProfileName(profileName)] = {
          skillsPath: absolutePath(skillsPath),
          rootEntries: null,
          rootEntriesMode: "auto",
        };
      }
      const again = await ask("是否继续增加分类? y/N", "N");
      keepAdding = /^y(es)?$/i.test(again);
    }

    const codexDir = await ask("Codex active skills 目录", next.targets.codex.activeDir);
    next.targets.codex = { activeDir: absolutePath(codexDir), enabled: true };
    const enableClaude = await ask("是否启用 Claude target? y/N", next.targets.claude.enabled ? "y" : "N");
    next.targets.claude.enabled = /^y(es)?$/i.test(enableClaude);
    if (next.targets.claude.enabled) {
      next.targets.claude.activeDir = absolutePath(await ask("Claude active skills 目录", next.targets.claude.activeDir));
    }
    next.linkStrategy = await ask("链接策略(auto/symlink/junction/copy)", next.linkStrategy);
    return normalizeConfig(next);
  } finally {
    rl.close();
  }
}

async function ensureConfig(filePath, args) {
  const existing = readJson(filePath, null);
  let config = normalizeConfig(existing || DEFAULT_CONFIG);
  config = applyArgOverrides(config, args);
  if (args.interactive) config = await applyInteractiveOverrides(config);
  if (Object.keys(config.profiles).length === 0) {
    throw new Error("首次初始化必须至少提供一个 --profile <分类>=<skills路径>");
  }
  writeJson(filePath, config, args);
  console.log(`${args.dryRun ? "[dry-run] 将写入" : "已写入"}配置: ${filePath}`);
  printProfiles(config);
  return config;
}

function realpathMaybe(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

function isInside(child, parent) {
  const childReal = realpathMaybe(child);
  const parentReal = realpathMaybe(parent);
  if (!childReal || !parentReal) return false;
  const rel = path.relative(parentReal, childReal);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function profileRoot(config, profileName) {
  return config.profiles[profileName]?.skillsPath;
}

function profileRootEntries(config, profileName) {
  const profile = config.profiles[profileName];
  if (!profile) return [];
  if (profile.rootEntriesMode === "none") return [];
  if (profile.rootEntriesMode === "manual") return profile.rootEntries || [];
  return autoRootEntries(profile.skillsPath);
}

// 解析 SKILL.md frontmatter 里的 name，作为 active skills 目录中的链接名。
function parseSkillName(skillFile) {
  const content = fs.readFileSync(skillFile, "utf8");
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "---") break;
    const match = line.match(/^name:\s*(.+?)\s*$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

// 初始化 skills 扫描：递归查找每个分类路径下的 SKILL.md。
function walkSkillFiles(root) {
  const result = [];
  if (!root || !fs.existsSync(root)) return result;

  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile() && entry.name === "SKILL.md") result.push(fullPath);
    }
  }
  return result.sort();
}

function discoverSkills(config, profileName) {
  const root = profileRoot(config, profileName);
  const skills = [];

  for (const skillFile of walkSkillFiles(root)) {
    const name = parseSkillName(skillFile);
    if (!name) continue;
    const target = path.dirname(skillFile);
    skills.push({
      kind: "skill",
      name,
      target: path.resolve(target),
      skillFile: path.resolve(skillFile),
      relativeTarget: path.relative(root, target),
    });
  }

  const grouped = new Map();
  for (const skill of skills) grouped.set(skill.name, [...(grouped.get(skill.name) || []), skill]);
  const duplicates = [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([name, items]) => ({ name, items }));

  return { skills, duplicates };
}

function topLevelSkillNames(skills, root) {
  const names = new Set();
  for (const skill of skills) {
    const rel = path.relative(root, skill.target);
    const first = rel.split(path.sep)[0];
    if (first) names.add(first);
  }
  return names;
}

// 自动识别 ai-toolkit 这类共享工作流依赖；普通根 README 不会单独触发纳入。
function autoRootEntries(root) {
  if (!root || !fs.existsSync(root)) return [];
  const hasMarker = AUTO_ROOT_MARKERS.some((entry) => lstatMaybe(path.join(root, entry)));
  if (!hasMarker) return [];
  return AUTO_ROOT_OPTIONAL_ENTRIES.filter((entry) => lstatMaybe(path.join(root, entry)));
}

function discoverRootAdjuncts(config, profileName) {
  const root = profileRoot(config, profileName);
  const discovered = discoverSkills(config, profileName);
  const skillTopNames = topLevelSkillNames(discovered.skills, root);
  const entries = [];
  for (const name of profileRootEntries(config, profileName)) {
    if (skillTopNames.has(name)) continue;
    const target = path.join(root, name);
    if (!lstatMaybe(target)) continue;
    entries.push({
      kind: "root-entry",
      name,
      target: path.resolve(target),
      relativeTarget: path.relative(root, target),
    });
  }
  return entries;
}

function readState(activeDir) {
  const payload = readJson(statePath(activeDir), { profile: null, managed: [], managedRootEntries: [] });
  payload.profile = payload.profile || payload.mode || null;
  if (!Array.isArray(payload.managed)) payload.managed = [];
  if (!Array.isArray(payload.managedRootEntries)) payload.managedRootEntries = [];
  return payload;
}

function linkTarget(linkPath) {
  try {
    return path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
  } catch {
    return null;
  }
}

function desiredTargetMatches(activePath, desiredTarget) {
  const stat = lstatMaybe(activePath);
  if (!desiredTarget || !stat?.isSymbolicLink()) return false;
  return realpathMaybe(linkTarget(activePath)) === realpathMaybe(desiredTarget);
}

function profileRoots(config) {
  return Object.values(config.profiles).map((profile) => profile.skillsPath);
}

function removeManagedEntry(activePath, item, dryRun) {
  const stat = lstatMaybe(activePath);
  if (!stat) return false;
  if (stat.isSymbolicLink()) {
    if (dryRun) console.log(`[dry-run] 移除链接 ${activePath}`);
    else fs.unlinkSync(activePath);
    return true;
  }
  if (item.linkKind === "copy") {
    if (dryRun) console.log(`[dry-run] 移除复制项 ${activePath}`);
    else fs.rmSync(activePath, { recursive: true, force: true });
    return true;
  }
  return false;
}

// 清理上一次切换时记录的受控项，避免误删用户手动创建的文件。
function removeManagedLinks(activeDir, config, state, desiredEntries, recreateAll, { dryRun = false } = {}) {
  const removed = [];
  const warnings = [];
  const desiredTargets = new Map(desiredEntries.map((entry) => [entry.name, entry.target]));

  for (const item of [...state.managed, ...state.managedRootEntries]) {
    const name = typeof item === "string" ? item : item.name;
    const expectedTarget = typeof item === "string" ? null : item.target;
    if (!name) continue;
    const activePath = path.join(activeDir, name);
    const desiredTarget = desiredTargets.get(name);

    if (!recreateAll && desiredTargetMatches(activePath, desiredTarget)) continue;
    if (!lstatMaybe(activePath)) continue;

    const stat = lstatMaybe(activePath);
    const currentTarget = stat.isSymbolicLink() ? linkTarget(activePath) : null;
    const targetAllowed =
      item.linkKind === "copy" ||
      (expectedTarget && realpathMaybe(currentTarget) === realpathMaybe(expectedTarget)) ||
      profileRoots(config).some((root) => isInside(currentTarget, root));

    if (!targetAllowed) {
      warnings.push(`跳过 ${activePath}: 链接目标不在已配置分类路径内`);
      continue;
    }

    if (!removeManagedEntry(activePath, item, dryRun)) {
      warnings.push(`跳过 ${activePath}: 不是受控链接或受控复制项`);
      continue;
    }
    removed.push(name);
  }
  return { removed, warnings };
}

function ensureNoDuplicateNames(discovered, root) {
  if (discovered.duplicates.length === 0) return;
  const lines = [`${root} 中存在重复 skill 名称:`];
  for (const duplicate of discovered.duplicates) {
    lines.push(`  ${duplicate.name}`);
    for (const item of duplicate.items) lines.push(`    - ${item.target}`);
  }
  throw new Error(lines.join("\n"));
}

// macOS/Linux 默认使用 symlink；Windows 目录默认使用 junction，必要时可配置 copy。
function plannedLinkKind(target, strategy) {
  const stat = fs.lstatSync(target);
  if (strategy === "copy") return "copy";
  if (strategy === "junction" && stat.isDirectory()) return "junction";
  if (strategy === "junction") return "symlink:file";
  if (strategy === "symlink") return stat.isDirectory() ? "symlink:dir" : "symlink:file";
  if (process.platform === "win32" && stat.isDirectory()) return "junction";
  return stat.isDirectory() ? "symlink:dir" : "symlink:file";
}

function copyEntry(source, destination) {
  const stat = fs.lstatSync(source);
  fs.rmSync(destination, { recursive: true, force: true });
  if (stat.isDirectory()) fs.cpSync(source, destination, { recursive: true, dereference: false });
  else fs.copyFileSync(source, destination);
}

function createEntryLink(entry, activePath, linkKind, dryRun) {
  if (dryRun) {
    const action = linkKind === "copy" ? "复制" : "创建链接";
    console.log(`[dry-run] ${action} ${entry.target} -> ${activePath}`);
    return;
  }
  if (linkKind === "copy") {
    copyEntry(entry.target, activePath);
    return;
  }
  const symlinkType = linkKind === "junction" ? "junction" : linkKind.endsWith(":dir") ? "dir" : "file";
  try {
    fs.symlinkSync(entry.target, activePath, symlinkType);
  } catch (error) {
    throw new Error(
      `创建链接失败: ${activePath} -> ${entry.target}。` +
        `当前策略为 ${linkKind}。Windows 上如果没有符号链接权限，请开启 Developer Mode，或使用 --link-strategy copy。原始错误: ${error.message}`,
    );
  }
}

// 创建当前分类需要投影到 active skills 目录的链接或复制项。
function createLinks(activeDir, config, entries, removedNames = new Set(), { dryRun = false, force = false } = {}) {
  const created = [];
  const warnings = [];
  fs.mkdirSync(activeDir, { recursive: true });

  for (const entry of entries) {
    const activePath = path.join(activeDir, entry.name);
    const linkKind = plannedLinkKind(entry.target, config.linkStrategy);
    const stat = lstatMaybe(activePath);
    const virtuallyRemoved = dryRun && removedNames.has(entry.name);

    if (!virtuallyRemoved && stat) {
      if (stat.isSymbolicLink()) {
        const currentTarget = linkTarget(activePath);
        if (realpathMaybe(currentTarget) === realpathMaybe(entry.target)) {
          created.push({ ...entry, unchanged: true, linkKind });
          continue;
        }
        if (!force) throw new Error(`${activePath} 已存在并指向 ${currentTarget}，如需替换请使用 --force`);
        if (dryRun) console.log(`[dry-run] 移除冲突链接 ${activePath}`);
        else fs.unlinkSync(activePath);
      } else if (force && linkKind === "copy") {
        if (dryRun) console.log(`[dry-run] 移除冲突文件/目录 ${activePath}`);
        else fs.rmSync(activePath, { recursive: true, force: true });
      } else {
        throw new Error(`${activePath} 已存在且不是符号链接，未使用 copy 策略时不会覆盖`);
      }
    }

    createEntryLink(entry, activePath, linkKind, dryRun);
    created.push({ ...entry, linkKind });
  }
  return { created, warnings };
}

function allKnownEntryNames(config) {
  const names = new Set();
  for (const profileName of Object.keys(config.profiles)) {
    for (const skill of discoverSkills(config, profileName).skills) names.add(skill.name);
    for (const entry of discoverRootAdjuncts(config, profileName)) names.add(entry.name);
  }
  return names;
}

function removeForceKnownLinks(activeDir, config, desiredEntries, removedNames, { dryRun = false, force = false } = {}) {
  if (!force) return { removed: [], warnings: [] };

  const desiredNames = new Set(desiredEntries.map((entry) => entry.name));
  const removed = [];
  const warnings = [];

  for (const name of allKnownEntryNames(config)) {
    if (desiredNames.has(name) || removedNames.has(name)) continue;
    const activePath = path.join(activeDir, name);
    const stat = lstatMaybe(activePath);
    if (!stat) continue;
    if (!stat.isSymbolicLink()) {
      warnings.push(`跳过 ${activePath}: 不是符号链接`);
      continue;
    }
    if (dryRun) console.log(`[dry-run] 移除已知工作流链接 ${activePath}`);
    else fs.unlinkSync(activePath);
    removed.push(name);
  }
  return { removed, warnings };
}

function sameManagedEntries(currentItems, desiredItems) {
  if (!Array.isArray(currentItems) || currentItems.length !== desiredItems.length) return false;
  const current = new Map(currentItems.map((item) => [typeof item === "string" ? item : item.name, typeof item === "string" ? null : item.target]));
  for (const desired of desiredItems) {
    if (!current.has(desired.name)) return false;
    const target = current.get(desired.name);
    if (!target || realpathMaybe(target) !== realpathMaybe(desired.target)) return false;
  }
  return true;
}

function stateEntries(entries, config) {
  return entries.map((entry) => ({
    kind: entry.kind,
    name: entry.name,
    target: entry.target,
    relativeTarget: entry.relativeTarget,
    linkKind: plannedLinkKind(entry.target, config.linkStrategy),
  }));
}

function targetNames(config, args) {
  if (args.target === "all") {
    return Object.entries(config.targets).filter(([, target]) => target.enabled).map(([name]) => name);
  }
  if (!config.targets[args.target]) throw new Error(`未知 target: ${args.target}`);
  return [args.target];
}

function ensureInitialized(config) {
  if (Object.keys(config.profiles).length === 0) {
    throw new Error("尚未初始化分类，请先执行 init --profile <分类>=<skills路径>");
  }
}

function switchProfileForTarget(profileName, targetName, config, options) {
  validateProfileName(profileName);
  const root = profileRoot(config, profileName);
  if (!root) throw new Error(`未知分类: ${profileName}`);
  if (!fs.existsSync(root)) throw new Error(`分类 skills 路径不存在: ${root}`);

  const target = config.targets[targetName];
  const activeDir = target.activeDir;
  const discovered = discoverSkills(config, profileName);
  ensureNoDuplicateNames(discovered, root);
  const rootAdjuncts = discoverRootAdjuncts(config, profileName);
  const desiredEntries = [...discovered.skills, ...rootAdjuncts];

  const state = readState(activeDir);
  const recreateAll = Boolean(state.linkStrategy && state.linkStrategy !== config.linkStrategy);
  const removal = removeManagedLinks(activeDir, config, state, desiredEntries, recreateAll, options);
  const forceRemoval = removeForceKnownLinks(activeDir, config, desiredEntries, new Set(removal.removed), options);
  const removedNames = new Set([...removal.removed, ...forceRemoval.removed]);
  const linkCreation = createLinks(activeDir, config, desiredEntries, removedNames, options);

  const managed = stateEntries(discovered.skills, config);
  const managedRootEntries = stateEntries(rootAdjuncts, config);
  const changed =
    state.profile !== profileName ||
    state.linkStrategy !== config.linkStrategy ||
    removal.removed.length > 0 ||
    forceRemoval.removed.length > 0 ||
    linkCreation.created.some((entry) => !entry.unchanged) ||
    !sameManagedEntries(state.managed, discovered.skills) ||
    !sameManagedEntries(state.managedRootEntries, rootAdjuncts);

  if (!changed) {
    console.log(`[${targetName}] 已经是 ${profileName} 分类`);
    console.log(`[${targetName}] skills 路径: ${root}`);
    console.log(`[${targetName}] active 目录: ${activeDir}`);
    console.log(`[${targetName}] 移除: 0`);
    console.log(`[${targetName}] 受控 skills: ${discovered.skills.length}`);
    console.log(`[${targetName}] 受控根附属项: ${rootAdjuncts.length}`);
    return;
  }

  const newState = {
    profile: profileName,
    target: targetName,
    updatedAt: new Date().toISOString(),
    activeDir,
    source: root,
    linkStrategy: config.linkStrategy,
    managed,
    managedRootEntries,
  };
  writeJson(statePath(activeDir), newState, options);
  console.log(`[${targetName}] ${options.dryRun ? "将切换到" : "已切换到"} ${profileName}`);
  console.log(`[${targetName}] skills 路径: ${root}`);
  console.log(`[${targetName}] active 目录: ${activeDir}`);
  console.log(`[${targetName}] 移除: ${removal.removed.length + forceRemoval.removed.length}`);
  console.log(`[${targetName}] 受控 skills: ${managed.length}`);
  console.log(`[${targetName}] 受控根附属项: ${managedRootEntries.length}`);
  for (const warning of [...removal.warnings, ...forceRemoval.warnings, ...linkCreation.warnings]) {
    console.log(`[${targetName}] 警告: ${warning}`);
  }
}

function switchProfile(profileName, config, args) {
  ensureInitialized(config);
  for (const targetName of targetNames(config, args)) {
    switchProfileForTarget(profileName, targetName, config, args);
  }
  console.log("切换成功后，请新开 Codex/Claude 线程或重启对应应用，让技能列表完全刷新。");
}

function printDiscover(config, profileName = null) {
  ensureInitialized(config);
  const profileNames = profileName ? [profileName] : Object.keys(config.profiles);
  for (const currentProfile of profileNames) {
    validateProfileName(currentProfile);
    const root = profileRoot(config, currentProfile);
    if (!root) throw new Error(`未知分类: ${currentProfile}`);
    const discovered = discoverSkills(config, currentProfile);
    const rootAdjuncts = discoverRootAdjuncts(config, currentProfile);
    console.log(`${currentProfile}: ${root}`);
    console.log(`  skills: ${discovered.skills.length}`);
    for (const skill of discovered.skills) console.log(`  - ${skill.name} -> ${skill.relativeTarget}`);
    if (discovered.duplicates.length > 0) {
      console.log("  重复名称:");
      for (const duplicate of discovered.duplicates) console.log(`  - ${duplicate.name}`);
    }
    console.log(`  根附属项: ${rootAdjuncts.length}`);
    for (const entry of rootAdjuncts) console.log(`  - ${entry.name} -> ${entry.relativeTarget}`);
  }
}

function printProfiles(config) {
  console.log("分类:");
  const profiles = Object.entries(config.profiles);
  if (profiles.length === 0) console.log("  (未初始化)");
  for (const [name, profile] of profiles) {
    console.log(`  - ${name}: ${profile.skillsPath}`);
    const mode = profile.rootEntriesMode || "auto";
    const count = profileRootEntries(config, name).length;
    console.log(`    根附属项: ${mode}，当前发现 ${count} 个`);
  }
  console.log("target:");
  for (const [name, target] of Object.entries(config.targets)) {
    console.log(`  - ${name}: ${target.activeDir} (${target.enabled ? "启用" : "未启用"})`);
  }
  console.log(`链接策略: ${config.linkStrategy}`);
}

function printStatusForTarget(config, targetName) {
  const target = config.targets[targetName];
  const activeDir = target.activeDir;
  const state = readState(activeDir);
  console.log(`[${targetName}] 当前分类: ${state.profile || "none"}`);
  console.log(`[${targetName}] active 目录: ${activeDir}`);
  console.log(`[${targetName}] 启用状态: ${target.enabled ? "启用" : "未启用"}`);
  console.log(`[${targetName}] 状态文件: ${statePath(activeDir)}`);
  console.log(`[${targetName}] 链接策略: ${state.linkStrategy || config.linkStrategy}`);

  const managed = Array.isArray(state.managed) ? state.managed : [];
  const managedRootEntries = Array.isArray(state.managedRootEntries) ? state.managedRootEntries : [];
  console.log(`[${targetName}] 受控 skills: ${managed.length}`);
  for (const item of managed) {
    const activePath = path.join(activeDir, item.name);
    const stat = lstatMaybe(activePath);
    const actualTarget = stat?.isSymbolicLink() ? linkTarget(activePath) : null;
    console.log(`  - ${item.name} -> ${actualTarget || item.target}${stat ? "" : " (active 链接缺失)"}`);
  }

  console.log(`[${targetName}] 受控根附属项: ${managedRootEntries.length}`);
  for (const item of managedRootEntries) {
    const activePath = path.join(activeDir, item.name);
    const stat = lstatMaybe(activePath);
    const actualTarget = stat?.isSymbolicLink() ? linkTarget(activePath) : null;
    console.log(`  - ${item.name} -> ${actualTarget || item.target}${stat ? "" : " (active 链接缺失)"}`);
  }

  const unmanaged = [];
  if (fs.existsSync(activeDir)) {
    const managedNames = new Set([...managed.map((item) => item.name), ...managedRootEntries.map((item) => item.name), STATE_FILE]);
    for (const entry of fs.readdirSync(activeDir).sort()) {
      if (!managedNames.has(entry)) unmanaged.push(entry);
    }
  }
  console.log(`[${targetName}] 未受控条目: ${unmanaged.length}`);
  for (const entry of unmanaged) console.log(`  - ${entry}`);
}

function printStatus(config, args) {
  printProfiles(config);
  for (const targetName of targetNames(config, args)) {
    printStatusForTarget(config, targetName);
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.config) process.env.WORKFLOW_SWITCHER_CONFIG = args.config;
    const cfgPath = configPath();

    if (args.command === "help" || args.command === "--help" || args.command === "-h") usage(0);

    if (args.command === "init") {
      const config = await ensureConfig(cfgPath, args);
      for (const [name, target] of Object.entries(config.targets)) {
        if (!target.enabled && name !== args.target) continue;
        if (args.dryRun) console.log(`[dry-run] 准备 active 目录 ${target.activeDir}`);
        else fs.mkdirSync(target.activeDir, { recursive: true });
      }
      return;
    }

    let config = loadConfig(cfgPath);
    config = applyArgOverrides(config, args);

    if (args.command === "status") printStatus(config, args);
    else if (args.command === "profiles") printProfiles(config);
    else if (args.command === "discover") printDiscover(config, args.rest[0] || null);
    else if (args.command === "switch" || args.command === "use") switchProfile(args.rest[0], config, args);
    else if (config.profiles[args.command]) switchProfile(args.command, config, args);
    else {
      console.error(`未知命令: ${args.command}`);
      usage(1);
    }
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }
}

await main();
