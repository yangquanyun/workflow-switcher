/**
 * 环境诊断模块。
 * by AI.Coding
 */
import fs from "node:fs";
import os from "node:os";
import { assertWritableDir } from "./fs-utils.mjs";
import { discoverSource, assertNoDuplicateNames } from "./scanner.mjs";
import { assertSymlinkCapability } from "./symlink.mjs";
import { readState } from "./state.mjs";

/**
 * 执行诊断并返回结构化结果。
 * @param {object} config 配置对象。
 * @param {string} cfgPath 配置文件路径。
 * @returns {Array<{scope:string,name:string,status:string,message:string}>} 诊断结果。
 */
export function runDoctor(config, cfgPath) {
  const checks = [];
  checks.push({ scope: "system", name: "platform", status: "INFO", message: `${os.platform()} ${os.arch()} Node ${process.version}` });
  checks.push({ scope: "config", name: cfgPath, status: fs.existsSync(cfgPath) ? "OK" : "WARN", message: fs.existsSync(cfgPath) ? "配置文件存在" : "配置文件不存在，将在 setup 后创建" });

  for (const [name, source] of Object.entries(config.sources)) {
    try {
      if (!fs.existsSync(source.skillsDir)) throw new Error("source 路径不存在");
      const discovered = discoverSource(source.skillsDir);
      assertNoDuplicateNames(discovered, source.skillsDir);
      checks.push({ scope: "source", name, status: "OK", message: `${source.skillsDir}，skills ${discovered.skills.length}，根附属项 ${discovered.rootAdjuncts.length}` });
    } catch (error) {
      checks.push({ scope: "source", name, status: "FAIL", message: `${source.skillsDir}: ${error.message}` });
    }
  }

  for (const [name, target] of Object.entries(config.targets)) {
    try {
      assertWritableDir(target.activeDir);
      assertSymlinkCapability(target.activeDir);
      const state = readState(target.activeDir);
      checks.push({ scope: "target", name, status: "OK", message: `${target.activeDir}，当前 source: ${state.currentSource || "none"}` });
    } catch (error) {
      checks.push({ scope: "target", name, status: "FAIL", message: `${target.activeDir}: ${error.message}` });
    }
  }

  return checks;
}

/**
 * 打印诊断结果。
 * @param {Array} checks 诊断结果。
 */
export function printDoctor(checks) {
  console.log("Workflow Switcher Doctor");
  for (const check of checks) {
    console.log(`[${check.status}] ${check.scope}/${check.name}: ${check.message}`);
  }
}
