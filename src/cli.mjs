/**
 * CLI 命令调度与交互脚手架。
 * by AI.Coding
 */
import fs from "node:fs";
import { BUILTIN_AGENT_CHOICES } from "./constants.mjs";
import { configPath } from "./paths.mjs";
import { loadConfig, removeSource, removeTarget, saveConfig, setSource, setTarget } from "./config.mjs";
import { discoverSource, assertNoDuplicateNames } from "./scanner.mjs";
import { resolveTargetNames, switchSource } from "./switcher.mjs";
import { readState } from "./state.mjs";
import { validateName } from "./validation.mjs";
import { askConfirm, askMultiSelect, askSelect, askText, createPrompt } from "./prompt.mjs";
import { printDoctor, runDoctor } from "./doctor.mjs";

/**
 * 校验 source 目录并打印扫描结果，保存配置前提前暴露路径和重复名称问题。
 * @param {string} skillsDir source skills 目录。
 */
function validateAndPrintSource(skillsDir) {
  if (!fs.existsSync(skillsDir)) throw new Error(`source skills 目录不存在: ${skillsDir}`);
  const discovered = discoverSource(skillsDir);
  assertNoDuplicateNames(discovered, skillsDir);
  console.log(`检测结果: skills ${discovered.skills.length}，根附属项 ${discovered.rootAdjuncts.length}`);
}

/**
 * 无参数主菜单，适合作为脚手架入口。
 */
async function runMenu() {
  const rl = createPrompt();
  try {
    while (true) {
      const action = await askSelect(rl, "请选择操作", [
        { label: "初始化 / 设置", value: "setup" },
        { label: "添加 source", value: "source-add" },
        { label: "添加 target", value: "target-add" },
        { label: "切换 workflow", value: "use" },
        { label: "查看状态", value: "status" },
        { label: "环境诊断", value: "doctor" },
        { label: "退出", value: "exit" },
      ]);

      if (action === "exit") return;
      if (action === "setup") {
        rl.close();
        return runSetup();
      }
      if (action === "source-add") {
        const source = await promptSource(rl);
        let config = setSource(loadConfig(), source.name, source.skillsDir);
        saveConfig(config);
        console.log("source 已保存");
      }
      if (action === "target-add") {
        const target = await promptTarget(rl);
        let config = setTarget(loadConfig(), target.name, target.activeDir, target.displayName);
        saveConfig(config);
        console.log("target 已保存");
      }
      if (action === "use") {
        const config = loadConfig();
        const sourceNames = Object.keys(config.sources);
        if (sourceNames.length === 0) {
          console.log("暂无 source，请先添加。");
          continue;
        }
        const sourceName = await askSelect(
          rl,
          "请选择 source",
          sourceNames.map((name) => ({ label: name, value: name })),
        );
        rl.close();
        return runUse(sourceName, { target: [] });
      }
      if (action === "status") printCurrent(true);
      if (action === "doctor") printDoctor(runDoctor(loadConfig(), configPath()));
    }
  } finally {
    // readline close 可重复调用；这里保证异常时终端状态被释放。
    rl.close();
  }
}

/**
 * 打印帮助文案。
 */
function printHelp() {
  console.log(`
workflow-switcher <命令> [参数]

命令:
  setup                         交互式初始化 source 和 target
  source add [名称] [路径]       添加 source
  source list                   查看 sources
  source remove <名称>          删除 source 配置
  target add [名称] [路径]       添加 target
  target list                   查看 targets
  target remove <名称>          删除 target 配置
  use <source>                  切换 source
  current                       查看当前 target 状态
  status                        查看配置和当前状态
  doctor                        诊断配置、路径和 symlink 权限
  help                          显示帮助

选项:
  --target <名称|all>           指定 use 的 target，可重复
  --display-name <名称>         target add 时指定展示名称
`.trim());
}

/**
 * 解析简单 CLI 参数；保持轻量，不引入第三方依赖。
 * @param {string[]} argv 原始参数。
 * @returns {{command:string,args:string[],options:object}} 解析结果。
 */
function parseArgs(argv) {
  const args = [];
  const options = { target: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") options.target.push(argv[++index]);
    else if (arg.startsWith("--target=")) options.target.push(arg.slice("--target=".length));
    else if (arg === "--display-name") options.displayName = argv[++index];
    else if (arg.startsWith("--display-name=")) options.displayName = arg.slice("--display-name=".length);
    else args.push(arg);
  }
  return { command: args[0] || null, args: args.slice(1), options };
}

/**
 * 根据内置显示名称或用户输入生成 target 信息；不提供任何默认路径。
 * @param {readline.Interface} rl readline 实例。
 * @returns {Promise<{name:string,displayName:string,activeDir:string}>} target 信息。
 */
async function promptTarget(rl) {
  const choices = [
    ...BUILTIN_AGENT_CHOICES.map((agent) => ({ label: agent.displayName, value: agent.slug })),
    { label: "自定义", value: "__custom__" },
  ];
  const selected = await askSelect(rl, "请选择智能体名称", choices);
  const builtin = BUILTIN_AGENT_CHOICES.find((agent) => agent.slug === selected);
  const name = selected === "__custom__" ? validateName(await askText(rl, "请输入 target 名称"), "target") : builtin.slug;
  const displayName = selected === "__custom__" ? name : builtin.displayName;
  const activeDir = await askText(rl, `请输入 ${displayName} 的 active skills 目录`);
  return { name, displayName, activeDir };
}

/**
 * 交互式添加 target。
 * @param {object} config 当前配置。
 * @returns {Promise<object>} 更新后的配置。
 */
async function interactiveAddTarget(config) {
  const rl = createPrompt();
  try {
    const target = await promptTarget(rl);
    return setTarget(config, target.name, target.activeDir, target.displayName);
  } finally {
    rl.close();
  }
}

/**
 * 使用指定 readline 收集 source 信息。
 * @param {readline.Interface} rl readline 实例。
 * @returns {Promise<{name:string,skillsDir:string}>} source 信息。
 */
async function promptSource(rl) {
  const name = validateName(await askText(rl, "请输入 source 名称"), "source");
  const skillsDir = await askText(rl, "请输入 source skills 目录");
  validateAndPrintSource(skillsDir);
  return { name, skillsDir };
}

/**
 * 交互式添加 source。
 * @param {object} config 当前配置。
 * @returns {Promise<object>} 更新后的配置。
 */
async function interactiveAddSource(config) {
  const rl = createPrompt();
  try {
    const source = await promptSource(rl);
    return setSource(config, source.name, source.skillsDir);
  } finally {
    rl.close();
  }
}

/**
 * setup 向导：用户完全自定义 target 路径和 source。
 */
async function runSetup() {
  let config = loadConfig();
  const rl = createPrompt();
  try {
    while (await askConfirm(rl, "是否添加 target？", Object.keys(config.targets).length === 0)) {
      const target = await promptTarget(rl);
      config = setTarget(config, target.name, target.activeDir, target.displayName);
    }
    while (await askConfirm(rl, "是否添加 source？", Object.keys(config.sources).length === 0)) {
      const source = await promptSource(rl);
      config = setSource(config, source.name, source.skillsDir);
    }
    saveConfig(config);
    console.log(`配置已保存: ${configPath()}`);
  } finally {
    rl.close();
  }
}

/**
 * 打印 source 列表。
 * @param {object} config 配置对象。
 */
function printSources(config) {
  const entries = Object.entries(config.sources);
  if (entries.length === 0) return console.log("暂无 source");
  for (const [name, source] of entries) console.log(`${name}: ${source.skillsDir}`);
}

/**
 * 打印 target 列表。
 * @param {object} config 配置对象。
 */
function printTargets(config) {
  const entries = Object.entries(config.targets);
  if (entries.length === 0) return console.log("暂无 target");
  for (const [name, target] of entries) console.log(`${name} (${target.displayName}): ${target.activeDir}`);
}

/**
 * 选择 use 命令的 target；未传 --target 且有多个 target 时进入交互选择。
 * @param {object} config 配置对象。
 * @param {string[]} requested 请求 target。
 * @returns {Promise<string[]>} target 名称列表。
 */
async function selectTargetsForUse(config, requested) {
  if (requested.length > 0) return resolveTargetNames(config, requested);
  const names = resolveTargetNames(config, []);
  if (names.length <= 1) return names;
  const rl = createPrompt();
  try {
    return askMultiSelect(
      rl,
      "请选择要切换的 target",
      names.map((name) => ({ label: `${name} (${config.targets[name].displayName})`, value: name })),
    );
  } finally {
    rl.close();
  }
}

/**
 * 执行 use 命令。
 * @param {string} sourceName source 名称。
 * @param {object} options 命令选项。
 */
async function runUse(sourceName, options) {
  if (!sourceName) throw new Error("use 需要指定 source 名称");
  const config = loadConfig();
  const targetNames = await selectTargetsForUse(config, options.target);
  if (targetNames.length === 0) throw new Error("未配置可用 target");
  const results = switchSource(config, sourceName, targetNames);
  for (const result of results) {
    console.log(`[${result.targetName}] 已切换到 ${result.sourceName}`);
    console.log(`[${result.targetName}] active 目录: ${result.activeDir}`);
    console.log(`[${result.targetName}] skills: ${result.skills}，根附属项: ${result.rootAdjuncts}`);
    console.log(`[${result.targetName}] 新建: ${result.created.length}，复用: ${result.unchanged.length}，移除: ${result.removed.length}`);
    for (const warning of result.warnings) console.log(`[${result.targetName}] 警告: ${warning}`);
  }
  console.log("切换完成后，请新开对应智能体会话或重启客户端，让 skills 列表刷新。");
}

/**
 * 打印当前状态。
 * @param {boolean} verbose 是否输出配置列表。
 */
function printCurrent(verbose = false) {
  const config = loadConfig();
  if (verbose) {
    console.log(`配置文件: ${configPath()}`);
    printSources(config);
    printTargets(config);
  }
  for (const [name, target] of Object.entries(config.targets)) {
    const state = readState(target.activeDir);
    console.log(`[${name}] 当前 source: ${state.currentSource || "none"}，active 目录: ${target.activeDir}`);
  }
}

/**
 * CLI 主入口。
 * @param {string[]} argv 参数列表。
 */
export async function main(argv = []) {
  const parsed = parseArgs(argv);
  try {
    if (!parsed.command) return runMenu();
    if (parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") return printHelp();
    if (parsed.command === "setup") return runSetup();

    if (parsed.command === "source") {
      const [sub, name, dir] = parsed.args;
      let config = loadConfig();
      if (sub === "add") {
        if (name && dir) validateAndPrintSource(dir);
        config = name && dir ? setSource(config, name, dir) : await interactiveAddSource(config);
        saveConfig(config);
        return console.log(`source 已保存: ${name || "(交互输入)"}`);
      }
      if (sub === "list") return printSources(config);
      if (sub === "remove") {
        config = removeSource(config, name);
        saveConfig(config);
        return console.log(`source 已删除: ${name}`);
      }
    }

    if (parsed.command === "target") {
      const [sub, name, dir] = parsed.args;
      let config = loadConfig();
      if (sub === "add") {
        config = name && dir ? setTarget(config, name, dir, parsed.options.displayName) : await interactiveAddTarget(config);
        saveConfig(config);
        return console.log(`target 已保存: ${name || "(交互输入)"}`);
      }
      if (sub === "list") return printTargets(config);
      if (sub === "remove") {
        config = removeTarget(config, name);
        saveConfig(config);
        return console.log(`target 已删除: ${name}`);
      }
    }

    if (parsed.command === "use") return runUse(parsed.args[0], parsed.options);
    if (parsed.command === "current") return printCurrent(false);
    if (parsed.command === "status") return printCurrent(true);
    if (parsed.command === "doctor") {
      const config = loadConfig();
      return printDoctor(runDoctor(config, configPath()));
    }

    throw new Error(`未知命令: ${parsed.command}`);
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exitCode = 1;
  }
}
