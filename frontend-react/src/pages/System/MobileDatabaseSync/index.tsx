/**
 * 移动端数据同步页（简化版）
 *
 * 仅支持从坚果云下载最新数据库，不支持上传/双向同步/备份列表等桌面端功能。
 * 替代桌面端 DatabaseBackup 页面在移动端的渲染，避免调用未实现的 /webdav/list
 * 和 /data-sync/* 等 API 触发 "me.some is not a function" 等错误。
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Space, Spin, Tag, Typography, App as AntApp } from 'antd';
import {
  CloudDownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  syncFromWebDAV,
} from '@/services/mobileSync';
import { databaseExists, copyDatabaseFromAssets, closeMobileDatabase, initMobileDatabase } from '@/services/mobileSqlite';
import { isMobileClient } from '@/utils/isDesktop';

const { Title, Paragraph, Text } = Typography;

interface SyncState {
  loading: boolean;
  hasDb: boolean;
  hasCreds: boolean;
  lastSyncAt: string | null;
  lastSize: number | null;
}

export default function MobileDatabaseSync() {
  // 桌面端不应渲染此页面（路由层已做拦截，这里做兜底）
  if (!isMobileClient()) return null;

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
      const hasDb = await databaseExists();
      setState((s) => ({
        ...s,
        loading: false,
        hasDb,
        hasCreds: true, // v3.5.3：内置默认凭据，恒为 true
      }));
    } catch (err) {
      console.error('[MobileSync] refresh status failed:', err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // 先关闭现有连接，避免覆盖时文件锁
      try { await closeMobileDatabase(); } catch { /* ignore */ }
      const result = await syncFromWebDAV();
      if (result.success) {
        message.success(result.message);
        setState((s) => ({
          ...s,
          hasDb: true,
          lastSyncAt: result.timestamp || new Date().toISOString(),
          lastSize: result.size ?? null,
        }));
        // 同步成功后延迟刷新整页，让新数据库生效
        setTimeout(() => window.location.reload(), 1200);
      } else {
        message.error(result.message);
        // 失败时重新打开连接
        try { await initMobileDatabase(); } catch { /* ignore */ }
      }
    } finally {
      setSyncing(false);
    }
  };

  // v3.5.3：从 APK 内置 DB 重新初始化（离线场景，无需联网）
  const handleRestoreFromAssets = async () => {
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
  };

  const formatSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatTime = (iso: string | null): string => {
    if (!iso) return '从未同步';
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <Card loading={state.loading}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            <CloudDownloadOutlined style={{ marginRight: 8, color: 'var(--color-primary)' }} />
            数据同步
          </Title>

          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            从坚果云下载最新的本地数据库快照，覆盖本地数据后即可离线查看报表。
            仅支持下载，不支持上传。
          </Paragraph>

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
                <Text type="secondary">坚果云凭据：</Text>
                {state.hasCreds ? (
                  <Tag color="success">已配置</Tag>
                ) : (
                  <Tag color="default">使用内置默认</Tag>
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
            >
              {state.hasDb ? '从坚果云同步' : '立即同步'}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRestoreFromAssets}
              disabled={syncing}
            >
              恢复内置数据
            </Button>
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
