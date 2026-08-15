/**
 * 空库首次使用引导（v3.8.2 数据安全改造配套）
 *
 * 背景：APK 不再内置真实业务数据库（防泄露），首次启动只有表结构空库。
 * 本组件在移动端/PWA 检测到空库时，在内容区顶部显示引导横幅，
 * 引导使用者配置 WebDAV 凭据并从坚果云拉取数据。
 *
 * 显示条件（全部满足）：
 *   - 移动端（Capacitor）或 PWA 端
 *   - 核心表 fact_conv_appmarket 行数为 0（空库），或查询失败（库未初始化）
 *   - 不在「数据同步」页面（避免引导循环）
 *
 * 文案按 WebDAV 是否已配置区分：
 *   - 未配置 → 「首次使用：请先配置 WebDAV 同步数据」→ 去配置（跳数据同步页）
 *   - 已配置 → 「数据库尚未同步，报表暂无数据」→ 去同步（跳数据同步页）
 */
import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';
import { querySql } from '@/services/mobileSqlite';
import { hasWebDAVCredentials } from '@/services/mobileSync';

const EMPTY_DB_CHECK_SQL = 'SELECT COUNT(*) AS CNT FROM fact_conv_appmarket';

const EmptyDbGuide: React.FC = () => {
  const [hasCreds, setHasCreds] = useState(false);
  const [needSync, setNeedSync] = useState(false);
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
      let empty = false;
      try {
        const rows = await querySql<{ CNT?: number }>(EMPTY_DB_CHECK_SQL);
        empty = Number(rows?.[0]?.CNT ?? 0) === 0;
      } catch {
        // 查询失败（数据库未初始化 / 尚未同步）→ 视为需要引导
        empty = true;
      }
      if (cancelled) return;
      let creds = false;
      try {
        creds = await hasWebDAVCredentials();
      } catch {
        creds = false; // 凭据查询异常按未配置处理
      }
      if (cancelled) return;
      setHasCreds(creds);
      setNeedSync(empty);
    })();

    return () => {
      cancelled = true;
    };
  }, [isMobile, onSyncPage, location.pathname]);

  if (!isMobile || onSyncPage || !needSync) return null;

  return (
    <Alert
      banner
      type={hasCreds ? 'warning' : 'info'}
      message={hasCreds ? '数据库尚未同步，报表暂无数据' : '首次使用：请先配置 WebDAV 同步数据'}
      description={
        hasCreds
          ? '点击下方按钮前往「数据同步」页，从坚果云拉取最新数据库'
          : '配置 WebDAV 凭据后从坚果云拉取数据库，报表即可正常显示（不会随安装包分发业务数据）'
      }
      action={
        <Button size="small" type={hasCreds ? 'primary' : 'default'} onClick={() => navigate('/system/database-backup')}>
          {hasCreds ? '去同步' : '去配置'}
        </Button>
      }
      closable
      style={{ marginBottom: 0, borderRadius: 0 }}
    />
  );
};

export default EmptyDbGuide;
