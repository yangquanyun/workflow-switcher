#!/usr/bin/env node

/**
 * Workflow Switcher CLI 入口。
 * by AI.Coding
 */
import { main } from "../src/cli.mjs";

// 顶层入口只负责把进程参数交给 CLI，显式捕获异常可避免顶层 await 的未完成警告。
main(process.argv.slice(2)).catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
