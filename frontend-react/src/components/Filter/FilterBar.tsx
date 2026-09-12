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
import EmployeeFilter from './EmployeeFilter';
import AppMarketFilter from './AppMarketFilter';
import ChannelTypeFilter from './ChannelTypeFilter';
import { useFilterStore } from '@/stores';
import styles from './FilterBar.module.scss';

interface FilterBarProps {
  showPlatform?: boolean;
  showAgency?: boolean;
  showBusinessModel?: boolean;
  showEmployee?: boolean;
  showAppMarket?: boolean;
  showChannelType?: boolean;
  /** 页面特有筛选控件插槽，渲染在操作按钮前 */
  children?: React.ReactNode;
  /** 外部传入的平台选项（优先使用，缺省时 PlatformFilter 从 metadata 加载） */
  platformOptions?: { value: string; label: string }[];
  onSearch?: (filters: {
    startDate: string;
    endDate: string;
    platforms: string[];
    agencies: string[];
    businessModels: string[];
    employees: string[];
    appMarkets: string[];
    channelTypes: string[];
  }) => void;
  onReset?: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  showPlatform = true,
  showAgency = true,
  showBusinessModel = false,
  showEmployee = false,
  showAppMarket = false,
  showChannelType = false,
  children,
  platformOptions,
  onSearch,
  onReset,
}) => {
  const {
    dateRange,
    selectedPlatforms,
    selectedAgencies,
    selectedBusinessModels,
    selectedEmployees,
    selectedAppMarkets,
    selectedChannelTypes,
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
      employees: selectedEmployees,
      appMarkets: selectedAppMarkets,
      channelTypes: selectedChannelTypes,
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
            <PlatformFilter options={platformOptions} />
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

        {/* 服务人员筛选 */}
        {showEmployee && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>服务人员:</span>
            <EmployeeFilter />
          </div>
        )}

        {/* 应用市场筛选 */}
        {showAppMarket && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>应用市场:</span>
            <AppMarketFilter />
          </div>
        )}

        {/* 渠道类型筛选 */}
        {showChannelType && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>渠道类型:</span>
            <ChannelTypeFilter />
          </div>
        )}

        {/* 页面特有筛选控件插槽 */}
        {children}

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