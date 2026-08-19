/**
 * 完整静默更新替换模块（v3.9.0）
 *
 * 从 resources/.update-staging/（后端下载解压的 full-update.zip 暂存）替换
 * resources 下运行时资产，与 exe 内 electron-builder extraResources 布局一致：
 *   - server/            （server.exe + _internal：Python 运行时 + 第三方库）
 *   - backend/           （业务源码，运行时由 resources/ import）
 *   - app.py / config.py （后端入口与配置）
 *   - frontend-react/dist/（前端构建产物）
 *   - version.json       （版本信息）
 *
 * 不替换：app.asar（Electron 壳，需重装 exe）、icon/、.env.example、elevate.exe。
 *
 * 约束：
 *   - server.exe 运行时被占用，替换前必须已停 Flask（由 main.ts 在调用本模块前 stopFlask）。
 *   - 替换采用「旧文件重命名 .old → 新文件移入」策略，任一步失败可回滚。
 *   - 替换成功后清理 .old 与 staging；替换失败保留 staging 供重试。
 */
import fs from 'node:fs';
import path from 'node:path';

export interface FullUpdateResult {
  ok: boolean;
  version?: string;
  error?: string;
  backups: string[];
}

/** 待替换的运行时资产（相对 projectRoot/resources 的路径），按替换顺序排列。 */
const TARGETS: string[] = ['server', 'backend', 'app.py', 'config.py', 'frontend-react/dist', 'version.json'];

/** 替换前必须存在的 staging 资产（校验更新包完整性）。 */
const REQUIRED_STAGING: string[] = [
  'server/server.exe',
  'backend/routes/version.py',
  'app.py',
  'config.py',
  'frontend-react/dist/index.html',
  'version.json',
];

function readVersion(resourcesRoot: string): string {
  try {
    const raw = fs.readFileSync(path.join(resourcesRoot, 'version.json'), 'utf-8');
    const data = JSON.parse(raw);
    return String(data.version || '');
  } catch {
    return '';
  }
}

/**
 * 原子替换：把 src 移入 dst（dst 已存在则先重命名为 .old），失败回滚。
 */
function replaceDirEntry(src: string, dst: string, backups: string[]): void {
  const oldPath = `${dst}.old`;
  if (fs.existsSync(oldPath)) fs.rmSync(oldPath, { recursive: true, force: true });
  if (fs.existsSync(dst)) {
    fs.renameSync(dst, oldPath);
    backups.push(oldPath);
  }
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
  } catch (e) {
    // 回滚：把 .old 移回，删除已移入的残缺目标
    try {
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
    } catch { /* ignore */ }
    for (let i = backups.length - 1; i >= 0; i -= 1) {
      const b = backups[i];
      if (fs.existsSync(b)) {
        const original = b.replace(/\.old$/, '');
        fs.renameSync(b, original);
      }
    }
    throw e;
  }
}

/**
 * 执行完整更新替换。调用方需先停 Flask（server.exe 占用）。
 *
 * @param resourcesRoot resources 目录绝对路径（exe 内即 app.getAppPath() 下 resources）
 * @returns 更新结果；失败时 staging 与旧文件保留。
 */
export function applyFullUpdate(resourcesRoot: string): FullUpdateResult {
  const staging = path.join(resourcesRoot, '.update-staging');
  const backups: string[] = [];

  // 1. 校验 staging 完整
  for (const rel of REQUIRED_STAGING) {
    if (!fs.existsSync(path.join(staging, rel))) {
      return { ok: false, error: `staging 缺少 ${rel}`, backups };
    }
  }

  const targetVersion = readVersion(staging);

  // 2. 逐个替换（旧 → .old，新 staging → 正式位）
  try {
    for (const rel of TARGETS) {
      const src = path.join(staging, rel);
      const dst = path.join(resourcesRoot, rel);
      replaceDirEntry(src, dst, backups);
    }
  } catch (e) {
    return {
      ok: false,
      error: `替换失败：${(e as Error).message}`,
      backups,
    };
  }

  // 3. 替换成功 → 清理 .old 备份与 staging
  for (const b of backups) {
    try {
      fs.rmSync(b, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
  try {
    fs.rmSync(staging, { recursive: true, force: true });
  } catch { /* ignore */ }

  return { ok: true, version: targetVersion, backups };
}
