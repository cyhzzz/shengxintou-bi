/**
 * 应用市场筛选器组件
 * 多选应用市场筛选，选项来自应用市场报表筛选接口
 */
import React from 'react';
import { Select } from 'antd';
import { useFilterStore } from '@/stores';
import { useAppMarketFilterOptionSets } from './useAppMarketFilterOptionSets';

const { Option } = Select;

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
