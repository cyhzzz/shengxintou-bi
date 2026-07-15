/**
 * 版本对比服务（v3.1.16）
 *
 * 静默从 GitHub raw URL 拉取最新 version.json，与本地版本对比。
 * 设计原则：
 * - 网络失败 / 解析失败 / 超时 → 全部静默返回 null，绝不抛错影响主流程
 * - 默认 5s 超时，避免挂起请求拖慢 UI
 * - fetch 走浏览器原生 fetch，绕过 Vite 代理（GitHub 是公网域名）
 */

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/cyhzzz/shengxintou-bi/main/version.json';
const FETCH_TIMEOUT_MS = 5000;

export interface RemoteVersionInfo {
  version: string;
  release_date: string;
  changelog?: string[];
}

export interface VersionCheckResult {
  hasUpdate: boolean;
  localVersion: string;
  remoteVersion: string;
  remoteReleaseDate?: string;
  remoteChangelog?: string[];
  reachable: boolean;
  error?: string;
  checkedAt: number;
}

export const parseVersion = (v: string | undefined | null): number[] => {
  if (!v) return [0, 0, 0];
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((s) => {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    });
};

export const compareVersion = (a: string, b: string): number => {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i += 1) {
    const ai = av[i] ?? 0;
    const bi = bv[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
};

export const fetchRemoteVersion = async (): Promise<RemoteVersionInfo | null> => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return null;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(GITHUB_RAW_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-cache',
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    const data = JSON.parse(text);
    if (typeof data?.version !== 'string') return null;
    return {
      version: String(data.version),
      release_date: String(data.release_date || ''),
      changelog: Array.isArray(data.changelog) ? data.changelog.slice(0, 8) : undefined,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
};

export const buildCheckResult = (
  localVersion: string,
  remote: RemoteVersionInfo | null,
  error?: string,
): VersionCheckResult => {
  if (!remote) {
    return {
      hasUpdate: false,
      localVersion,
      remoteVersion: '',
      reachable: false,
      error,
      checkedAt: Date.now(),
    };
  }
  return {
    hasUpdate: compareVersion(remote.version, localVersion) > 0,
    localVersion,
    remoteVersion: remote.version,
    remoteReleaseDate: remote.release_date,
    remoteChangelog: remote.changelog,
    reachable: true,
    checkedAt: Date.now(),
  };
};
