/**
 * 应用市场筛选器组件
 * 多选应用市场筛选，选项来自应用市场报表筛选接口
 */
import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { useFilterStore } from '@/stores';
import { dataServiceReports } from '@/services/dataService';

const { Option } = Select;

interface FilterOption {
  value: string;
  label: string;
}

export interface AppMarketFilterOptionSets {
  appMarkets: FilterOption[];
  channelTypes: FilterOption[];
}

// 模块级缓存：跨实例、跨页面共享，同一会话只请求一次筛选选项
let cachedSets: AppMarketFilterOptionSets | null = null;
let pendingPromise: Promise<AppMarketFilterOptionSets | null> | null = null;

const fetchOptionSets = (): Promise<AppMarketFilterOptionSets | null> => {
  if (cachedSets) return Promise.resolve(cachedSets);
  if (pendingPromise) return pendingPromise;
  pendingPromise = dataServiceReports
    .getAppMarketFilterOptions()
    .then((res) => {
      if (!res?.success || !res.data) return null;
      const sets: AppMarketFilterOptionSets = {
        appMarkets: (res.data.app_markets || []).map((m) => ({ value: m, label: m })),
        channelTypes: (res.data.channel_types || []).map((c) => ({ value: c, label: c })),
      };
      cachedSets = sets;
      return sets;
    })
    .catch(() => null)
    .finally(() => {
      // 失败不缓存结果，下次挂载可重试
      pendingPromise = null;
    });
  return pendingPromise;
};

/**
 * 共享筛选选项加载（应用市场 + 渠道类型）
 * 供 AppMarketFilter / ChannelTypeFilter 共用，Detail 页 FilterBar 内两个筛选器只发一次请求
 */
export const useAppMarketFilterOptionSets = (): AppMarketFilterOptionSets => {
  const [sets, setSets] = useState<AppMarketFilterOptionSets>(
    cachedSets ?? { appMarkets: [], channelTypes: [] }
  );

  useEffect(() => {
    if (cachedSets) return;
    let cancelled = false;
    fetchOptionSets().then((result) => {
      if (cancelled || !result) return;
      setSets(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return sets;
};

interface AppMarketFilterProps {
  onChange?: (markets: string[]) => void;
  allowClear?: boolean;
  placeholder?: string;
}

const AppMarketFilter: React.FC<AppMarketFilterProps> = ({
  onChange,
  allowClear = true,
  placeholder = '选择应用市场',
}) => {
  const { selectedAppMarkets, setAppMarkets } = useFilterStore();
  const { appMarkets } = useAppMarketFilterOptionSets();

  const handleChange = (values: string[]) => {
    setAppMarkets(values);
    onChange?.(values);
  };

  return (
    <Select
      mode="multiple"
      value={selectedAppMarkets}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear={allowClear}
      style={{ minWidth: 200 }}
      maxTagCount="responsive"
    >
      {appMarkets.map((market) => (
        <Option key={market.value} value={market.value}>
          {market.label}
        </Option>
      ))}
    </Select>
  );
};

export default AppMarketFilter;
