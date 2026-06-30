/**
 * symlink 创建与权限预检。
 * by AI.Coding
 */
import fs from "node:fs";
import path from "node:path";
import { linkTarget, lstatMaybe, realpathMaybe } from "./fs-utils.mjs";

/**
 * 根据目标类型选择 Node symlink 类型；Windows 也坚持使用 symlink，不使用 junction。
 * @param {string} target 真实目标路径。
 * @returns {"dir" | "file"} symlink 类型。
 */
export function symlinkTypeForTarget(target) {
  const stat = fs.lstatSync(target);
  return stat.isDirectory() ? "dir" : "file";
}

/**
 * 判断现有 symlink 是否已经指向目标。
 * @param {string} linkPath 链接路径。
 * @param {string} target 期望目标。
 * @returns {boolean} 是否一致。
 */
export function symlinkMatches(linkPath, target) {
  const stat = lstatMaybe(linkPath);
  if (!stat?.isSymbolicLink()) return false;
  return realpathMaybe(linkTarget(linkPath)) === realpathMaybe(target);
}

/**
 * 创建 symlink；调用前应完成冲突检查和清理。
 * @param {string} target 真实目标。
 * @param {string} linkPath 链接路径。
 */
export function createSymlink(target, linkPath) {
  fs.symlinkSync(target, linkPath, symlinkTypeForTarget(target));
}

/**
 * 在 target 目录中真实创建文件和目录 symlink，提前暴露 Windows 权限问题。
 * @param {string} activeDir target active skills 目录。
 */
export function assertSymlinkCapability(activeDir) {
  fs.mkdirSync(activeDir, { recursive: true });
  const root = path.join(activeDir, `.workflow-switcher-preflight-${process.pid}-${Date.now()}`);
  const sourceFile = path.join(root, "source-file.txt");
  const sourceDir = path.join(root, "source-dir");
  const linkFile = path.join(root, "link-file.txt");
  const linkDir = path.join(root, "link-dir");

  try {
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(sourceFile, "preflight");
    // 文件 symlink 和目录 symlink 都必须通过，才能保证 symlink-only 策略可执行。
    fs.symlinkSync(sourceFile, linkFile, "file");
    fs.symlinkSync(sourceDir, linkDir, "dir");
  } catch (error) {
    throw new Error(
      `无法在 ${activeDir} 创建符号链接。请在 Windows 开启 Developer Mode，` +
        `或让管理员授予 Create symbolic links 权限，或以管理员身份运行终端。原始错误: ${error.message}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
