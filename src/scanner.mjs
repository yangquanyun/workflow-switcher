/**
 * workflow source 扫描模块。
 * by AI.Coding
 */
import fs from "node:fs";
import path from "node:path";
import { AUTO_ROOT_MARKERS, AUTO_ROOT_OPTIONAL_ENTRIES } from "./constants.mjs";
import { lstatMaybe } from "./fs-utils.mjs";

/**
 * 解析 SKILL.md frontmatter 中的 name 字段。
 * @param {string} skillFile SKILL.md 路径。
 * @returns {string | null} skill 名称。
 */
export function parseSkillName(skillFile) {
  const content = fs.readFileSync(skillFile, "utf8");
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") break;
    const match = line.match(/^name:\s*(.+?)\s*$/);
    if (match) {
      // 去掉简单引号，保留用户在 skill 中定义的真实名称。
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

/**
 * 递归查找 source 下所有 SKILL.md。
 * @param {string} root source 根目录。
 * @returns {string[]} SKILL.md 路径列表。
 */
export function walkSkillFiles(root) {
  const result = [];
  if (!root || !fs.existsSync(root)) return result;
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      // 无权限目录不让扫描中断，后续 doctor 会暴露路径问题。
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

/**
 * 扫描 source 下的 skill 条目并识别重复名称。
 * @param {string} root source 根目录。
 * @returns {{skills:Array,duplicates:Array}} 扫描结果。
 */
export function discoverSkills(root) {
  const skills = [];
  for (const skillFile of walkSkillFiles(root)) {
    const name = parseSkillName(skillFile);
    if (!name) continue;
    const target = path.dirname(skillFile);
    skills.push({
      kind: "skill",
      name,
      target: path.resolve(target),
      relativeTarget: path.relative(root, target),
      skillFile: path.resolve(skillFile),
    });
  }

  const grouped = new Map();
  for (const skill of skills) grouped.set(skill.name, [...(grouped.get(skill.name) || []), skill]);
  const duplicates = [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([name, items]) => ({ name, items }));
  return { skills, duplicates };
}

/**
 * 自动识别 workflow 根附属项。
 * @param {string} root source 根目录。
 * @returns {Array} 根附属项列表。
 */
export function discoverRootAdjuncts(root) {
  if (!root || !fs.existsSync(root)) return [];
  const hasWorkflowMarker = AUTO_ROOT_MARKERS.some((entry) => lstatMaybe(path.join(root, entry)));
  if (!hasWorkflowMarker) return [];

  return AUTO_ROOT_OPTIONAL_ENTRIES.filter((entry) => lstatMaybe(path.join(root, entry))).map((name) => ({
    kind: "root-entry",
    name,
    target: path.resolve(path.join(root, name)),
    relativeTarget: name,
  }));
}

/**
 * 生成某个 source 的完整投影条目，包含 skills 和根附属项。
 * @param {string} root source 根目录。
 * @returns {{skills:Array,rootAdjuncts:Array,duplicates:Array,entries:Array}} 投影结果。
 */
export function discoverSource(root) {
  const discovered = discoverSkills(root);
  const skillNames = new Set(discovered.skills.map((skill) => skill.name));
  const rootAdjuncts = discoverRootAdjuncts(root).filter((entry) => !skillNames.has(entry.name));
  const rootNameConflicts = discoverRootAdjuncts(root).filter((entry) => skillNames.has(entry.name));
  const duplicates = [
    ...discovered.duplicates,
    ...rootNameConflicts.map((entry) => ({ name: entry.name, items: [entry] })),
  ];
  return {
    skills: discovered.skills,
    rootAdjuncts,
    duplicates,
    entries: [...discovered.skills, ...rootAdjuncts],
  };
}

/**
 * 重复名称存在时直接抛错，阻止后续切换。
 * @param {{duplicates:Array}} discovered 扫描结果。
 * @param {string} root source 根目录。
 */
export function assertNoDuplicateNames(discovered, root) {
  if (discovered.duplicates.length === 0) return;
  const lines = [`${root} 中存在重复投影名称:`];
  for (const duplicate of discovered.duplicates) {
    lines.push(`  ${duplicate.name}`);
    for (const item of duplicate.items) lines.push(`    - ${item.target || item.relativeTarget}`);
  }
  throw new Error(lines.join("\n"));
}
