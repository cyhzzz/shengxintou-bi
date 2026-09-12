/**
 * 应用市场筛选选项共享 hook
 * 应用市场 + 渠道类型选项来自同一接口；模块级缓存跨实例共享，同一会话只请求一次
 */
import { useState, useEffect } from 'react';
import { dataServiceReports } from '@/services/dataService';

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
