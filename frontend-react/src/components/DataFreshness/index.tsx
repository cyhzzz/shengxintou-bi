import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Tag, Spin, Button } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { metadataService } from '@/services';
import { dataServiceWebdav, type WebdavSyncStatus } from '@/services/dataService';
import type { DataFreshness } from '@/services/metadataService';
import styles from './index.module.scss';

interface DataFreshnessIndicatorProps {
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** 点击"立即更新"的回调 */
  onUpdateClick?: () => void;
  /** 是否紧凑模式（用于帮助弹窗） */
  compact?: boolean;
}

export interface DataFreshnessIndicatorRef {
  refresh: () => void;
}

// 状态配置
const statusConfig = {
  normal: {
    icon: <CheckCircleOutlined />,
    color: 'success' as const,
    label: '正常',
  },
  warning: {
    icon: <WarningOutlined />,
    color: 'warning' as const,
    label: '建议更新',
  },
  critical: {
    icon: <CloseCircleOutlined />,
    color: 'error' as const,
    label: '需立即更新',
  },
  no_data: {
    icon: <QuestionCircleOutlined />,
    color: 'default' as const,
    label: '无数据',
  },
};

// 分组标签（v3.1 与后端 v2 表 key 对齐）
const groupLabels: Record<string, string> = {
  channel_ads: '广告投放汇总',
  content: '内容平台',
  app_market: '应用市场',
  omni: '全渠道开户',
};

export const DataFreshnessIndicator = forwardRef<DataFreshnessIndicatorRef, DataFreshnessIndicatorProps>(
  ({ showActions = true, onUpdateClick, compact = false }, ref) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DataFreshness | null>(null);
    const [expanded, setExpanded] = useState(!compact);
    // v3.4.1: 同步状态（云端 vs 本地最新日期）
    const [syncStatus, setSyncStatus] = useState<WebdavSyncStatus | null>(null);

    // 加载数据
    const loadData = useCallback(async () => {
      setLoading(true);
      try {
        const response = await metadataService.getDataFreshness();
        if (response.success && response.data) {
          setData(response.data);
          // 如果有严重警告，自动展开
          const hasCritical = Object.values(response.data as Record<string, { status?: string }>).some(
            (item) => item.status === 'critical'
          );
          if (hasCritical && compact) {
            setExpanded(true);
          }
        }
      } catch (error) {
        console.error('加载数据新鲜度失败:', error);
      } finally {
        setLoading(false);
      }
    }, [compact]);

    // v3.4.1: 加载云端同步状态（静默：连接失败不报错）
    const loadSyncStatus = useCallback(async () => {
      try {
        const res = await dataServiceWebdav.checkSyncStatus();
        if (res?.success) setSyncStatus(res.data);
      } catch {
        // 静默
      }
    }, []);

    // 暴露 refresh 方法给父组件
    useImperativeHandle(ref, () => ({
      refresh: loadData,
    }));

  useEffect(() => {
    loadData();
    loadSyncStatus();
    // 5分钟自动刷新
    const timer = setInterval(() => {
      loadData();
      loadSyncStatus();
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadData, loadSyncStatus]);

  // 计算汇总
  const calculateSummary = () => {
    if (!data) return { total: 0, normal: 0, warning: 0, critical: 0 };
    const summary = { total: 0, normal: 0, warning: 0, critical: 0 };
    Object.values(data).forEach((item) => {
      summary.total++;
      if (item.status && item.status !== 'no_data') {
        summary[item.status as keyof typeof summary]++;
      }
    });
    return summary;
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '无数据';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 渲染状态点
  const renderDots = () => {
    if (!data) return null;
    return Object.values(data).map((item, index) => {
      const dotClass = styles[`dot_${item.status}`];
      return <span key={index} className={`${styles.dot} ${dotClass}`} />;
    });
  };

  // 按分组渲染数据项
  const renderGroups = () => {
    if (!data) return null;

    const sortedData = Object.values(data).sort((a, b) => a.order - b.order);
    const groups = ['channel_ads', 'content', 'app_market', 'omni'];

    return groups.map((groupKey) => {
      const groupItems = sortedData.filter((item) => item.group === groupKey);
      if (groupItems.length === 0) return null;

      return (
        <div key={groupKey} className={styles.group}>
          <div className={styles.groupLabel}>{groupLabels[groupKey]}</div>
          <div className={styles.groupItems}>
            {groupItems.map((item, index) => {
              const config = statusConfig[item.status] || statusConfig.no_data;
              return (
                <div key={index} className={styles.item}>
                  <Tag
                    icon={config.icon}
                    color={config.color}
                    className={styles.statusTag}
                  >
                    {item.name}
                  </Tag>
                  <span className={styles.date}>{formatDate(item.latest_date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Spin size="small" />
        <span className={styles.loadingText}>加载中...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <span className={styles.errorText}>数据加载失败</span>
      </div>
    );
  }

  const summary = calculateSummary();
  const hasWarning = summary.warning > 0 || summary.critical > 0;

  // 紧凑模式（用于帮助弹窗）
  if (compact && !expanded) {
    return (
      <div className={styles.compactSummary} onClick={() => setExpanded(true)}>
        <span className={styles.label}>数据状态</span>
        <div className={styles.dots}>{renderDots()}</div>
        {hasWarning && (
          <Tag color="warning" className={styles.warningTag}>
            {summary.warning + summary.critical}项需更新
          </Tag>
        )}
        <SyncOutlined className={styles.refreshIcon} onClick={(e) => {
          e.stopPropagation();
          loadData();
        }} />
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      {/* 摘要行 */}
      {compact && (
        <div className={styles.summary} onClick={() => setExpanded(false)}>
          <span className={styles.label}>数据状态</span>
          <div className={styles.dots}>{renderDots()}</div>
          {hasWarning && (
            <Tag color="warning" className={styles.warningTag}>
              {summary.warning + summary.critical}项需更新
            </Tag>
          )}
        </div>
      )}

      {/* 详情列表 */}
      <div className={styles.details}>
        {/* v3.4.1: 云端 vs 本地对比 Tag */}
        {syncStatus && syncStatus.cloud_available && (
          <div className={styles.syncRow}>
            <Tag
              color={syncStatus.need_sync ? 'warning' : 'success'}
              icon={<CloudDownloadOutlined />}
            >
              {syncStatus.need_sync
                ? syncStatus.needs_meta_rebuild
                  ? `云端备份新于本地但缺 meta(云端数据日期待重建)`
                  : `云端数据日期 ${syncStatus.cloud_data_latest?.slice(5) || '-'} 比本地 ${syncStatus.local_latest?.slice(5) || '-'} 新 ${syncStatus.diff_hours}h`
                : `云端与本地数据日期一致（${syncStatus.local_latest?.slice(5) || '-'}）`}
            </Tag>
          </div>
        )}
        {renderGroups()}

        {/* 操作按钮 */}
        {showActions && (
          <div className={styles.actions}>
            {hasWarning && (
              <Button type="primary" size="small" onClick={onUpdateClick}>
                立即更新
              </Button>
            )}
            {compact && (
              <Button size="small" onClick={() => setExpanded(false)}>
                收起
              </Button>
            )}
            <Button size="small" icon={<SyncOutlined />} onClick={loadData}>
              刷新
            </Button>
          </div>
        )}
      </div>
    </div>
  );
  }
);

DataFreshnessIndicator.displayName = 'DataFreshnessIndicator';

export default DataFreshnessIndicator;