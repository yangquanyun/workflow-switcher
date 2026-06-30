/**
 * switcher 模块测试。
 * by AI.Coding
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { switchSource } from "../src/switcher.mjs";
import { readState, writeState } from "../src/state.mjs";

/**
 * 写入一个测试 skill。
 * @param {string} root source 根目录。
 * @param {string} dir skill 目录名。
 * @param {string} name skill 名称。
 */
function writeSkill(root, dir, name) {
  const skillDir = path.join(root, dir);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: test\n---\n`);
}

test("switchSource 使用 symlink 投影 skills 和根附属项", { skip: process.platform === "win32" }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-switcher-switch-"));
  const source = path.join(root, "source");
  const active = path.join(root, "active");
  fs.mkdirSync(source, { recursive: true });

  try {
    writeSkill(source, "coding", "coding");
    fs.writeFileSync(path.join(source, "WORKFLOW.md"), "workflow");

    const config = {
      version: 3,
      sources: { V5: { skillsDir: source } },
      targets: { codex: { displayName: "Codex", activeDir: active, enabled: true } },
    };

    const [result] = switchSource(config, "V5", ["codex"]);
    const state = readState(active);

    assert.equal(result.skills, 1);
    assert.equal(result.rootAdjuncts, 1);
    assert.equal(fs.lstatSync(path.join(active, "coding")).isSymbolicLink(), true);
    assert.equal(fs.lstatSync(path.join(active, "WORKFLOW.md")).isSymbolicLink(), true);
    assert.equal(state.currentSource, "V5");
    assert.equal(state.managed.length, 1);
    assert.equal(state.managedRootEntries.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("switchSource 遇到被改指向的受控名称时阻止切换", { skip: process.platform === "win32" }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-switcher-conflict-"));
  const source = path.join(root, "source");
  const active = path.join(root, "active");
  const oldTarget = path.join(root, "old-coding");
  const rogueTarget = path.join(root, "rogue-coding");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(active, { recursive: true });
  fs.mkdirSync(oldTarget, { recursive: true });
  fs.mkdirSync(rogueTarget, { recursive: true });

  try {
    writeSkill(source, "coding", "coding");
    fs.symlinkSync(rogueTarget, path.join(active, "coding"), "dir");
    writeState(active, {
      target: "codex",
      currentSource: "OLD",
      sourceDir: root,
      managed: [{ kind: "skill", name: "coding", target: oldTarget, relativeTarget: "coding" }],
      managedRootEntries: [],
    });

    const config = {
      version: 3,
      sources: { V5: { skillsDir: source }, OLD: { skillsDir: root } },
      targets: { codex: { displayName: "Codex", activeDir: active, enabled: true } },
    };

    assert.throws(() => switchSource(config, "V5", ["codex"]), /不是本工具受控项/);
    assert.equal(fs.realpathSync(path.join(active, "coding")), fs.realpathSync(rogueTarget));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
