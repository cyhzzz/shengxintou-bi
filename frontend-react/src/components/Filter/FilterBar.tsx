/**
 * 筛选器工具栏组件
 * 组合日期、平台、代理商等筛选条件
 */
import React from 'react';
import { Space, Button, Card } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import DateRangeFilter from './DateRangeFilter';
import PlatformFilter from './PlatformFilter';
import AgencyFilter from './AgencyFilter';
import BusinessModelFilter from './BusinessModelFilter';
import { useFilterStore } from '@/stores';
import styles from './FilterBar.module.scss';

interface FilterBarProps {
  showPlatform?: boolean;
  showAgency?: boolean;
  showBusinessModel?: boolean;
  onSearch?: (filters: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
    businessModels: string[];
  }) => void;
  onReset?: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  showPlatform = true,
  showAgency = true,
  showBusinessModel = false,
  onSearch,
  onReset,
}) => {
  const {
    dateRange,
    selectedPlatforms,
    selectedAgencies,
    selectedBusinessModels,
    resetAll,
  } = useFilterStore();

  // 查询按钮点击
  const handleSearch = () => {
    onSearch?.({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      platforms: selectedPlatforms,
      agencies: selectedAgencies,
      businessModels: selectedBusinessModels,
    });
  };

  // 重置按钮点击
  const handleReset = () => {
    resetAll();
    onReset?.();
  };

  return (
    <Card className={styles.filterBar} size="small">
      <Space size="middle" wrap>
        {/* 日期范围筛选 */}
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>日期范围:</span>
          <DateRangeFilter />
        </div>

        {/* 平台筛选 */}
        {showPlatform && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>平台:</span>
            <PlatformFilter />
          </div>
        )}

        {/* 代理商筛选 */}
        {showAgency && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>代理商:</span>
            <AgencyFilter />
          </div>
        )}

        {/* 业务模式筛选 */}
        {showBusinessModel && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>业务模式:</span>
            <BusinessModelFilter />
          </div>
        )}

        {/* 操作按钮 */}
        <Space size={8}>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

export default FilterBar;