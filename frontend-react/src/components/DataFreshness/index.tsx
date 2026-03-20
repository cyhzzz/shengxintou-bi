import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Tag, Spin, Button } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { metadataService } from '@/services';
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

// 分组标签
const groupLabels: Record<string, string> = {
  account_ads: '账号数据',
  xhs_notes: '笔记数据',
  backend_conversions: '转化数据',
};

export const DataFreshnessIndicator = forwardRef<DataFreshnessIndicatorRef, DataFreshnessIndicatorProps>(
  ({ showActions = true, onUpdateClick, compact = false }, ref) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DataFreshness | null>(null);
    const [expanded, setExpanded] = useState(!compact);

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

    // 暴露 refresh 方法给父组件
    useImperativeHandle(ref, () => ({
      refresh: loadData,
    }));

  useEffect(() => {
    loadData();
    // 5分钟自动刷新
    const timer = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadData]);

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
    const groups = ['account_ads', 'xhs_notes', 'backend_conversions'];

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