/**
 * config 模块测试。
 * by AI.Coding
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { addIgnoredSkills, normalizeConfig, removeIgnoredSkills, setIgnoredSkills, setSource, setTarget } from "../src/config.mjs";

test("normalizeConfig 不内置任何 target 或 source", () => {
  const config = normalizeConfig(null);
  assert.deepEqual(config.sources, {});
  assert.deepEqual(config.targets, {});
});

test("setSource 和 setTarget 保存用户输入路径", () => {
  let config = normalizeConfig(null);
  config = setSource(config, "V5", "./skills");
  config = setTarget(config, "codex", "./active");

  assert.equal(config.sources.V5.skillsDir, path.resolve("./skills"));
  assert.deepEqual(config.sources.V5.ignoredSkills, []);
  assert.equal(config.targets.codex.activeDir, path.resolve("./active"));
});

test("ignoredSkills 会去重、去空并支持添加和恢复", () => {
  let config = normalizeConfig(null);
  config = setSource(config, "V5", "./skills");
  config = setIgnoredSkills(config, "V5", ["debugging", " ", "coding", "coding"]);

  assert.deepEqual(config.sources.V5.ignoredSkills, ["coding", "debugging"]);

  config = addIgnoredSkills(config, "V5", ["reviewing"]);
  assert.deepEqual(config.sources.V5.ignoredSkills, ["coding", "debugging", "reviewing"]);

  config = removeIgnoredSkills(config, "V5", ["debugging"]);
  assert.deepEqual(config.sources.V5.ignoredSkills, ["coding", "reviewing"]);
});
