/**
 * useVersionCheck Hook（v3.1.16）
 *
 * 在 App 挂载时静默拉取 GitHub version.json，与本地版本号比较。
 * - 默认只在 mount 时拉一次，结果存 sessionStorage（避免 SPA 内重复拉取）
 * - 网络失败静默：不抛错、不弹 message、不影响主流程
 * - 可手动调用 refresh() 重新拉取
 */
import { useCallback, useEffect, useState } from 'react';
import {
  buildCheckResult,
  fetchRemoteVersion,
  type VersionCheckResult,
} from '@/services/versionCheckService';
import { dataService } from '@/services';

const SESSION_KEY = 'sxtbi-version-check';

const readCached = (): VersionCheckResult | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VersionCheckResult;
    if (Date.now() - (parsed.checkedAt || 0) > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCached = (result: VersionCheckResult) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
  } catch {
    // ignore
  }
};

export const useVersionCheck = () => {
  const [result, setResult] = useState<VersionCheckResult | null>(() => readCached());
  const [loading, setLoading] = useState(false);

  const runCheck = useCallback(async (force = false) => {
    if (loading) return;
    if (!force) {
      const cached = readCached();
      if (cached) {
        setResult(cached);
        return;
      }
    }
    setLoading(true);
    try {
      let localVersion = '';
      try {
        const resp = await dataService.getVersion();
        if (resp.success && resp.data) {
          localVersion = String(resp.data.version || '');
        }
      } catch {
        // 静默
      }
      const remote = await fetchRemoteVersion();
      const finalResult = buildCheckResult(localVersion, remote);
      setResult(finalResult);
      writeCached(finalResult);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    runCheck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    hasUpdate: result?.hasUpdate ?? false,
    localVersion: result?.localVersion ?? '',
    remoteVersion: result?.remoteVersion ?? '',
    remoteReleaseDate: result?.remoteReleaseDate,
    remoteChangelog: result?.remoteChangelog,
    reachable: result?.reachable ?? false,
    loading,
    refresh: () => runCheck(true),
  };
};

export default useVersionCheck;
