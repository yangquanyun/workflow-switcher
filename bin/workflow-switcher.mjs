#!/usr/bin/env node

/**
 * Workflow Switcher CLI 入口。
 * by AI.Coding
 */
import { main } from "../src/cli.mjs";

// 顶层入口只负责把进程参数交给 CLI，便于测试复用 main 函数。
await main(process.argv.slice(2));
