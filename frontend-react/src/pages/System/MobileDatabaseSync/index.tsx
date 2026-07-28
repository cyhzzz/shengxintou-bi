/**
 * 移动端数据同步页（简化版）
 *
 * 仅支持从坚果云下载最新数据库，不支持上传/双向同步/备份列表等桌面端功能。
 * 替代桌面端 DatabaseBackup 页面在移动端的渲染，避免调用未实现的 /webdav/list
 * 和 /data-sync/* 等 API 触发 "me.some is not a function" 等错误。
 *
 * v3.5.3 修复：所有 Hooks 必须在 `if (!isMobileClient()) return null` 之前调用，
 * 否则违反 Rules of Hooks → React 严格模式崩溃 → 白屏。
 *
 * v3.6.0：移除打包时内置凭据，改为用户在前端可视化配置 WebDAV（与桌面版一致体验）
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Space, Spin, Tag, Typography, Alert, App as AntApp } from 'antd';
import {
  CloudDownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { syncFromWebDAV, hasWebDAVCredentials } from '@/services/mobileSync';
import { databaseExists, copyDatabaseFromAssets, closeMobileDatabase, initMobileDatabase } from '@/services/mobileSqlite';
import { isMobileClient, isPwaClient } from '@/utils/isDesktop';
import MobileSyncButton from '@/components/MobileSyncButton';

const { Title, Paragraph, Text } = Typography;

interface SyncState {
  loading: boolean;
  hasDb: boolean;
  hasCreds: boolean;
  lastSyncAt: string | null;
  lastSize: number | null;
}

export default function MobileDatabaseSync() {
  // 所有 Hooks 必须在条件 return 之前调用（Rules of Hooks）
  const { message } = AntApp.useApp();
  const [state, setState] = useState<SyncState>({
    loading: false,
    hasDb: false,
    hasCreds: false,
    lastSyncAt: null,
    lastSize: null,
  });
  const [syncing, setSyncing] = useState(false);

  const refreshStatus = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      // v3.7.0：PWA 端用 sql.js 的 IndexedDB 检查，安卓端用 Capacitor 原生检查
      const dbCheck = isPwaClient()
        ? (await import('@/services/sqlJsAdapter')).hasLocalDb()
        : databaseExists();
      const [hasDb, hasCreds] = await Promise.all([dbCheck, hasWebDAVCredentials()]);
      setState((s) => ({
        ...s,
        loading: false,
        hasDb,
        hasCreds,
      }));
    } catch (err) {
      console.error('[MobileSync] refresh status failed:', err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      // v3.7.0：PWA 端 sql.js 自动管理 DB 生命周期，无需 closeMobileDatabase
      if (!isPwaClient()) {
        try { await closeMobileDatabase(); } catch { /* ignore */ }
      }
      const result = await syncFromWebDAV();
      if (result.success) {
        message.success(result.message);
        setState((s) => ({
          ...s,
          hasDb: true,
          hasCreds: true,
          lastSyncAt: result.timestamp || new Date().toISOString(),
          lastSize: result.size ?? null,
        }));
        setTimeout(() => window.location.reload(), 1200);
      } else {
        message.error(result.message);
        if (!isPwaClient()) {
          try { await initMobileDatabase(); } catch { /* ignore */ }
        }
      }
    } finally {
      setSyncing(false);
    }
  }, [message]);

  // v3.7.0：PWA 端没有内置 DB，此函数仅在安卓端有效
  const handleRestoreFromAssets = useCallback(async () => {
    if (isPwaClient()) return;
    setSyncing(true);
    try {
      try { await closeMobileDatabase(); } catch { /* ignore */ }
      await copyDatabaseFromAssets(true);
      await initMobileDatabase();
      message.success('已从内置数据恢复');
      setState((s) => ({ ...s, hasDb: true, lastSyncAt: new Date().toISOString() }));
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      message.error('恢复失败: ' + (err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [message]);

  const formatSize = useCallback((bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }, []);

  const formatTime = useCallback((iso: string | null): string => {
    if (!iso) return '从未同步';
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return iso;
    }
  }, []);

  // 桌面端不应渲染此页面（路由层已做拦截，这里做兜底）
  // v3.7.0：PWA 端也渲染此页面（无 Flask 后端，必须从坚果云同步本地 DB）
  // 必须在所有 Hooks 之后 return
  if (!isMobileClient() && !isPwaClient()) return null;
  const pwaMode = isPwaClient();

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <Card loading={state.loading}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Title level={4} style={{ margin: 0 }}>
              <CloudDownloadOutlined style={{ marginRight: 8, color: 'var(--color-primary)' }} />
              数据同步
            </Title>
            <MobileSyncButton />
          </div>

          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            从坚果云下载最新的本地数据库快照，覆盖本地数据后即可离线查看报表。
            仅支持下载，不支持上传。
          </Paragraph>

          {/* v3.6.0：未配置时友好引导，不报错 */}
          {!state.hasCreds && !state.loading && (
            <Alert
              type="info"
              showIcon
              icon={<SettingOutlined />}
              message="尚未配置 WebDAV 服务器"
              description="点击右上角「WebDAV 配置」按钮，填入坚果云服务器地址、账号和应用密码即可启用云同步。配置仅保存在本机，不会随安装包分发。"
            />
          )}

          {/* 状态卡片 */}
          <Card size="small" type="inner">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">本地数据库：</Text>
                {state.hasDb ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">已就绪</Tag>
                ) : (
                  <Tag icon={<WarningOutlined />} color="warning">未初始化</Tag>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">WebDAV 凭据：</Text>
                {state.hasCreds ? (
                  <Tag color="success">已配置</Tag>
                ) : (
                  <Tag color="orange">未配置</Tag>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">上次同步：</Text>
                <Text>{formatTime(state.lastSyncAt)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">数据库大小：</Text>
                <Text>{formatSize(state.lastSize)}</Text>
              </div>
            </Space>
          </Card>

          {/* 操作按钮 */}
          <Space wrap>
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              loading={syncing}
              onClick={handleSync}
              size="large"
              disabled={!state.hasCreds}
            >
              {state.hasDb ? '从坚果云同步' : '立即同步'}
            </Button>
            {/* v3.7.0：PWA 端无内置 DB，不显示「恢复内置数据」按钮 */}
            {!pwaMode && (
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRestoreFromAssets}
                disabled={syncing}
              >
                恢复内置数据
              </Button>
            )}
            <Button
              onClick={refreshStatus}
              disabled={syncing}
            >
              刷新状态
            </Button>
          </Space>

          {syncing && (
            <div style={{ textAlign: 'center', padding: 12 }}>
              <Spin tip="正在从坚果云下载数据库..." />
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
}
