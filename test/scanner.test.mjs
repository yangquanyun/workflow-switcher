/**
 * scanner 模块测试。
 * by AI.Coding
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverSource, parseSkillName } from "../src/scanner.mjs";

/**
 * 创建临时 source 目录。
 * @returns {string} 临时目录。
 */
function makeTempSource() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "workflow-switcher-scanner-"));
}

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

test("parseSkillName 解析 frontmatter name", () => {
  const root = makeTempSource();
  try {
    writeSkill(root, "coding", "coding");
    assert.equal(parseSkillName(path.join(root, "coding", "SKILL.md")), "coding");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("discoverSource 扫描 skills 和根附属项", () => {
  const root = makeTempSource();
  try {
    writeSkill(root, "coding", "coding");
    writeSkill(root, "debugging", "debugging");
    fs.writeFileSync(path.join(root, "WORKFLOW.md"), "workflow");
    fs.mkdirSync(path.join(root, ".best-practices"));

    const result = discoverSource(root);

    assert.equal(result.skills.length, 2);
    assert.deepEqual(result.rootAdjuncts.map((item) => item.name).sort(), [".best-practices", "WORKFLOW.md"]);
    assert.equal(result.entries.length, 4);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("discoverSource 按 skill name 忽略投影项", () => {
  const root = makeTempSource();
  try {
    writeSkill(root, "coding", "coding");
    writeSkill(root, "debugging", "debugging");

    const result = discoverSource(root, { ignoredSkills: ["debugging"] });

    assert.deepEqual(result.skills.map((item) => item.name), ["coding"]);
    assert.deepEqual(result.entries.map((item) => item.name), ["coding"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("被忽略的 skill 不参与重复名称校验", () => {
  const root = makeTempSource();
  try {
    writeSkill(root, "coding-a", "coding");
    writeSkill(root, "coding-b", "coding");

    const result = discoverSource(root, { ignoredSkills: ["coding"] });

    assert.equal(result.skills.length, 0);
    assert.equal(result.duplicates.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
