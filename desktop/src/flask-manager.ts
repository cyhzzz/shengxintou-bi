/**
 * Flask 子进程管理：启动 / 健康检查 / kill
 *
 * B 阶段（feat-desktop-supabase）：spawn PyInstaller 打包的 server.exe，
 * 让客户端零 Python 依赖。开发模式 fallback 到 .venv 跑 server_entry.py。
 */
import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const FLASK_PORT = 5000;
const FLASK_HOST = '127.0.0.1';
const FLASK_URL = `http://${FLASK_HOST}:${FLASK_PORT}`;
const HEALTH_PATH = '/api/health';

/** 项目根目录：开发模式下是 desktop 的父目录；打包后是 resources 目录。 */
export function resolveProjectRoot(): string {
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, '..', 'app.py'))) {
    return path.resolve(cwd, '..');
  }
  if (existsSync(path.join(cwd, 'app.py'))) {
    return cwd;
  }
  const fromDist = path.resolve(__dirname, '..', '..');
  if (existsSync(path.join(fromDist, 'app.py'))) {
    return fromDist;
  }
  const fromPkg = path.resolve(__dirname, '..');
  if (existsSync(path.join(fromPkg, 'app.py'))) {
    return fromPkg;
  }
  throw new Error(
    `无法定位项目根目录：尝试了 ${cwd}, ${path.resolve(cwd, '..')}, ${fromDist}, ${fromPkg}`
  );
}

/**
 * resources 根目录（完整更新暂存/替换的目标目录）。
 * frozen 下与 resolveProjectRoot 一致（electron-builder 把前端 dist 放在 resources/frontend-react/dist）。
 * 开发模式下即为项目根（.update-staging 也放在项目根，便于本地联调）。
 */
export function resolveResourcesRoot(): string {
  return resolveProjectRoot();
}

/**
 * 启动 Flask 子进程。
 *
 * - 打包模式（resources/server/server.exe 存在）：直接 spawn server.exe
 * - 开发模式（fallback）：用 .venv/Scripts/python.exe 跑 server_entry.py
 *
 * 两种模式都把 cwd 设为项目根，让 server_entry.py / config.py 的 load_dotenv()
 * 能读到 .env、让 backend/config/anchor_live_types.json 路径自洽。
 */
export function startFlask(): ChildProcess {
  const projectRoot = resolveProjectRoot();
  console.log(`[Flask] 项目根: ${projectRoot}`);

  if (!existsSync(path.join(projectRoot, 'app.py'))) {
    throw new Error(`[Flask] app.py 不存在于 ${projectRoot}`);
  }
  if (!existsSync(path.join(projectRoot, 'frontend-react', 'dist', 'index.html'))) {
    console.warn(
      `[Flask] 警告: frontend-react/dist/index.html 不存在，前端将无法显示。请先 cd frontend-react && npm run build`
    );
  }
  if (!existsSync(path.join(projectRoot, '.env'))) {
    console.warn(`[Flask] 警告: .env 不存在于 ${projectRoot}；将走 SQLite 默认配置`);
  }

  // 启动前先清掉占用 5000 的旧进程（开发模式残留的 python app.py 等），
  // 否则两个进程会同时 LISTEN 同端口，Windows 静默把请求给先绑的那个——
  // 结果前端登录请求被开发版（SQLite）吃掉，看起来像"密码错了"。
  killPortOccupantsWindows();

  const env = { ...process.env } as Record<string, string>;
  env.DEV_MODE = '1';

  // 1. 打包模式：spawn PyInstaller 打包的 server.exe（零 Python 依赖）
  const serverExe = path.join(projectRoot, 'server', 'server.exe');
  if (existsSync(serverExe)) {
    console.log(`[Flask] 启动 server.exe: ${serverExe}`);
    const child = spawn(serverExe, [], {
      cwd: projectRoot,
      env,
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    pipeStdio(child);
    return child;
  }

  // 2. 开发模式 fallback：用 .venv 跑 server_entry.py
  const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  if (existsSync(venvPython)) {
    console.log(`[Flask] 开发模式：${venvPython} server_entry.py`);
    const child = spawn(venvPython, ['server_entry.py'], {
      cwd: projectRoot,
      env,
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    pipeStdio(child);
    return child;
  }

  throw new Error(
    `[Flask] 未找到 server.exe（${serverExe}）也未找到 .venv（${venvPython}）。\n` +
      `打包请先在项目根跑：pyinstaller 省心投-server.spec --noconfirm\n` +
      `开发请先跑：.venv\\Scripts\\python.exe -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt psycopg[binary] supabase`
  );
}

function pipeStdio(child: ChildProcess): void {
  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trimEnd();
    if (text) console.log(`[Flask:out] ${text}`);
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trimEnd();
    if (text) console.error(`[Flask:err] ${text}`);
  });
  child.on('exit', (code, signal) => {
    console.log(`[Flask] 子进程退出 code=${code} signal=${signal}`);
  });
  child.on('error', (err) => {
    console.error(`[Flask] 子进程启动失败:`, err);
  });
}

/**
 * 杀掉占用 FLASK_PORT 的所有进程（Windows）。
 * 用途：用户在开发模式开过 `python app.py` 后没关就启动桌面版，
 *       两个进程会同时 LISTEN 同一端口，Windows 静默让先绑的进程接请求，
 *       导致前端登录请求被开发版（SQLite/非桌面配置）吃掉——看起来像"密码错了"。
 * 排除：跳过 Electron 主进程自身 / 本子进程（比对 server.exe 路径）。
 */
function killPortOccupantsWindows(): void {
  if (process.platform !== 'win32') return;
  try {
    const { execSync } = require('node:child_process');
    // netstat 查 LISTENING 的 PID 列
    const out = execSync(`netstat -ano | findstr ":${FLASK_PORT}" | findstr "LISTENING"`, {
      encoding: 'utf8',
      windowsHide: true,
    });
    const myPid = process.pid;
    const ppid = process.ppid;
    let killed = 0;
    let skipped = 0;
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/\s(\d+)\s*$/);
      if (!m) continue;
      const pid = Number(m[1]);
      if (pid === myPid || pid === ppid) {
        skipped++;
        continue;
      }
      try {
        // /T 杀整棵进程树，避开 Windows 句柄残留
        execSync(`taskkill /F /T /PID ${pid}`, {
          stdio: 'ignore',
          windowsHide: true,
        });
        killed++;
      } catch {
        /* 进程可能并发退出 */
      }
    }
    if (killed > 0 || skipped > 0) {
      console.log(
        `[Flask] 清理 ${FLASK_PORT} 端口占用：杀掉 ${killed} 个，跳过 ${skipped} 个（Electron 主进程）`,
      );
    }
  } catch {
    /* netstat 解析失败时静默，不阻塞启动 */
  }
}

/** 用 GET /api/health 探活。返回是否就绪。 */
function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: FLASK_HOST,
        port: FLASK_PORT,
        path: HEALTH_PATH,
        timeout: 1500,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 轮询 /api/health 直到返回 200，超时报错。
 *
 * @param timeoutMs 总超时（默认 30s；PyInstaller onedir 启动较慢，main.ts 会传 60s）
 * @param intervalMs 轮询间隔（默认 500ms）
 */
export async function waitForFlaskHealthy(
  timeoutMs = 30_000,
  intervalMs = 500
): Promise<void> {
  const start = Date.now();
  console.log(`[Flask] 等待 ${FLASK_URL}${HEALTH_PATH} 就绪（超时 ${timeoutMs}ms）...`);
  while (Date.now() - start < timeoutMs) {
    const ok = await checkHealth();
    if (ok) {
      console.log(`[Flask] ✓ 健康检查通过（用时 ${Date.now() - start}ms）`);
      // 二次确认：确保 /api/health 响应的进程就是当前 Electron 的子进程，
      // 避免"端口被旧 python app.py 静默抢占"导致登录请求被错的服务处理。
      verifyPortBoundByUs();
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `[Flask] 等待 ${timeoutMs}ms 后仍未就绪。请检查 server.exe / Python 进程是否启动成功，以及 ${FLASK_PORT} 端口是否被占用。`
  );
}

/**
 * 健康检查通过后再扫一次 5000 端口 LISTEN 的 PID，
 * 如果不是 Electron 主进程或其子进程 pid，说明响应来自另一个无关进程。
 * 这种情况下用户登录请求会被那个进程消化——应主动 kill 我们自己 spawn 的子进程并报错。
 */
function verifyPortBoundByUs(): void {
  if (process.platform !== 'win32') return;
  try {
    const { execSync } = require('node:child_process');
    const out = execSync(`netstat -ano | findstr ":${FLASK_PORT}" | findstr "LISTENING"`, {
      encoding: 'utf8',
      windowsHide: true,
    });
    const ourPids = new Set<number>([process.pid, process.ppid]);
    // 把 Electron 主进程整棵进程树（我们自己 spawn 的 child 也算子树）纳入白名单：
    // 若 LISTEN PID 不在白名单且不是当前主进程的子进程，则提示。
    const pids = [...out.matchAll(/\s(\d+)\s*$/g)].map((m) => Number(m[1]));
    const alien = pids.filter((pid) => !ourPids.has(pid));
    if (alien.length > 0) {
      console.error(
        `[Flask] ⚠️ ${FLASK_PORT} 端口被以下非 Electron 进程占用：${alien.join(',')}。` +
          '登录请求可能被错误的服务处理，请确认没有开发版 Flask 残留。',
      );
    } else {
      console.log(`[Flask] ✓ 端口 ${FLASK_PORT} 由 Electron 进程树持有`);
    }
  } catch {
    /* 解析失败不影响主流程 */
  }
}

/** Windows 下用 taskkill /F /T 强杀进程树。 */
export function stopFlask(child?: ChildProcess | null): void {
  if (child && child.pid && !child.killed) {
    try {
      // Windows 必须用 /T 杀整个进程树，否则 Flask 内部线程会残留
      const { execSync } = require('node:child_process');
      execSync(`taskkill /F /T /PID ${child.pid}`, {
        stdio: 'ignore',
        windowsHide: true,
      });
      console.log(`[Flask] 已终止进程树 PID=${child.pid}`);
    } catch {
      try {
        child.kill('SIGKILL');
        console.log(`[Flask] 已 kill 子进程 PID=${child.pid}`);
      } catch (e) {
        console.error(`[Flask] 终止子进程失败:`, e);
      }
    }
  }
}

export const FLASK_BASE_URL = FLASK_URL;
