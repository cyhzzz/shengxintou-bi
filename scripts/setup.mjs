#!/usr/bin/env node
// -*- coding: utf-8 -*-
// 省心投 BI - 跨平台 setup 入口（Node.js）
//
// npm run setup 会调用本文件。它会自动按平台选择最合适的安装脚本：
//   - Windows → scripts/setup.bat
//   - 其他    → bash scripts/setup.sh
// 兜底：python scripts/setup.py

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: root, ...opts });
    child.on("exit", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`${cmd} ${args.join(" ")} 退出码 ${code}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  const candidates = isWin
    ? [
        ["cmd.exe", ["/c", "scripts\\setup.bat"]],
        ["python", ["scripts/setup.py"]],
      ]
    : [
        ["bash", ["scripts/setup.sh"]],
        ["python3", ["scripts/setup.py"]],
        ["python", ["scripts/setup.py"]],
      ];

  for (const [cmd, args] of candidates) {
    const exe = cmd === "cmd.exe" ? cmd : (await import("node:child_process")).spawnSync("where", isWin ? [cmd] : ["which", cmd]).stdout?.toString().trim();
    if (!exe) continue;
    console.log(`[setup.mjs] 调用: ${cmd} ${args.join(" ")}`);
    try {
      await run(cmd, args);
      console.log("\n[setup.mjs] ✓ 全部依赖已就绪");
      process.exit(0);
    } catch (err) {
      console.error(`[setup.mjs] ${cmd} 失败: ${err.message}`);
    }
  }
  console.error("[setup.mjs] 所有安装方式均失败，请手动运行 scripts/setup.bat 或 scripts/setup.sh");
  process.exit(1);
}

main();