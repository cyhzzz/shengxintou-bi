/**
 * 空库 / 数据过期引导（v3.8.2 数据安全改造配套，v3.8.8 修正判定逻辑）
 *
 * 背景：APK 不再内置真实业务数据库（防泄露），首次启动只有表结构空库；
 * 移动端/PWA 必须从坚果云拉取数据库才能看到报表。
 *
 * 显示条件（满足其一即显示，且不在「数据同步」页自身）：
 *   - 未配置 WebDAV 凭据 → 「首次使用：请先配置 WebDAV 同步数据」（info）
 *   - 已配置 + 核心表 fact_conv_appmarket 行数为 0（空库）→ 「数据库尚未同步，报表暂无数据」（warning）
 *   - 已配置 + 库有数据但距上次同步超过 STALE_DAYS 天 → 「本地数据可能不是最新」（info）
 *
 * v3.8.8 修正：
 *   - 旧实现 querySql 抛异常即 `empty = true`，与 App.tsx 冷启动并发初始化竞态
 *     会导致「每次冷启动都误弹空库引导」。改为：读不出时重试一次，仍失败标 unknown（不误报）。
 *   - 旧实现只判「空」，不判「过期」。新增按上次同步时间戳的过期判定，
 *     满足「数据库空 或 数据非最新 才出现」的预期。
 */
import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';
import { querySql, initMobileDatabase } from '@/services/mobileSqlite';
import { hasWebDAVCredentials, getLastSyncAt } from '@/services/mobileSync';

const EMPTY_DB_CHECK_SQL = 'SELECT COUNT(*) AS CNT FROM fact_conv_appmarket';
// 距上次成功同步超过该天数视为「数据可能非最新」（仅在有数据时提示）
const STALE_DAYS = 7;

type DbState = 'unknown' | 'empty' | 'fresh' | 'stale';

const EmptyDbGuide: React.FC = () => {
  const [hasCreds, setHasCreds] = useState(false);
  const [dbState, setDbState] = useState<DbState>('unknown');
  const [staleDays, setStaleDays] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // 仅移动端 / PWA 端需要本地数据库，Web/桌面端走后端 API 不检查
  const isMobile = isMobileClient() || isPwaClient();
  // 数据同步页自身不显示引导（避免引导循环）
  const onSyncPage = location.pathname === '/system/database-backup';

  useEffect(() => {
    if (!isMobile || onSyncPage) return;

    let cancelled = false;
    (async () => {
      // 1) 判定库是否真的为空（核心表有数据 = 已同步）
      let empty = false;
      let queryOk = true;
      try {
        const rows = await querySql<{ CNT?: number }>(EMPTY_DB_CHECK_SQL);
        empty = Number(rows?.[0]?.CNT ?? 0) === 0;
      } catch {
        // 查询失败：可能是与 App 启动初始化的竞态。重试一次（必要时先确保连接就绪）。
        queryOk = false;
        try {
          if (!isPwaClient()) {
            try { await initMobileDatabase(); } catch { /* ignore */ }
          }
          const rows = await querySql<{ CNT?: number }>(EMPTY_DB_CHECK_SQL);
          empty = Number(rows?.[0]?.CNT ?? 0) === 0;
          queryOk = true;
        } catch {
          // 重试仍失败：读不出数据，但不谎报空库，交由 unknown 状态不显示引导
          queryOk = false;
        }
      }
      if (cancelled) return;

      // 2) WebDAV 凭据
      let creds = false;
      try {
        creds = await hasWebDAVCredentials();
      } catch {
        creds = false; // 凭据查询异常按未配置处理
      }
      if (cancelled) return;
      setHasCreds(creds);

      // 3) 综合判定
      if (!queryOk) {
        // 读不出数据：不误报空库，也不提示过期
        setDbState('unknown');
        return;
      }
      if (empty) {
        setDbState('empty');
        return;
      }
      // 库有数据：判断是否过期
      let state: DbState = 'fresh';
      if (creds) {
        try {
          const last = await getLastSyncAt();
          if (last) {
            const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
            if (days > STALE_DAYS) {
              state = 'stale';
              setStaleDays(days);
            }
          }
        } catch {
          // 读取失败不视为过期
        }
      }
      if (cancelled) return;
      setDbState(state);
    })();

    return () => {
      cancelled = true;
    };
  }, [isMobile, onSyncPage, location.pathname, isPwaClient]);

  if (!isMobile || onSyncPage) return null;
  if (dbState === 'fresh' || dbState === 'unknown') return null;

  // 未配置凭据 → 首次使用引导
  if (!hasCreds) {
    return (
      <Alert
        banner
        type="info"
        message="首次使用：请先配置 WebDAV 同步数据"
        description="配置 WebDAV 凭据后从坚果云拉取数据库，报表即可正常显示（不会随安装包分发业务数据）"
        action={
          <Button size="small" type="default" onClick={() => navigate('/system/database-backup')}>
            去配置
          </Button>
        }
        closable
        style={{ marginBottom: 0, borderRadius: 0 }}
      />
    );
  }

  // 已配置凭据
  if (dbState === 'empty') {
    return (
      <Alert
        banner
        type="warning"
        message="数据库尚未同步，报表暂无数据"
        description="点击下方按钮前往「数据同步」页，从坚果云拉取最新数据库"
        action={
          <Button size="small" type="primary" onClick={() => navigate('/system/database-backup')}>
            去同步
          </Button>
        }
        closable
        style={{ marginBottom: 0, borderRadius: 0 }}
      />
    );
  }

  // dbState === 'stale'：库有数据但可能过期
  return (
    <Alert
      banner
      type="info"
      message="本地数据可能不是最新"
      description={`距上次同步已 ${staleDays} 天，点击下方按钮前往「数据同步」页拉取最新数据库`}
      action={
        <Button size="small" type="primary" onClick={() => navigate('/system/database-backup')}>
          去同步
        </Button>
      }
      closable
      style={{ marginBottom: 0, borderRadius: 0 }}
    />
  );
};

export default EmptyDbGuide;
