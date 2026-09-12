/**
 * 渠道类型筛选器组件
 * 多选渠道类型筛选，选项与应用市场筛选共享同一接口
 */
import React from 'react';
import { Select } from 'antd';
import { useFilterStore } from '@/stores';
import { useAppMarketFilterOptionSets } from './useAppMarketFilterOptionSets';

const { Option } = Select;

interface ChannelTypeFilterProps {
  onChange?: (types: string[]) => void;
  allowClear?: boolean;
  placeholder?: string;
}

const ChannelTypeFilter: React.FC<ChannelTypeFilterProps> = ({
  onChange,
  allowClear = true,
  placeholder = '选择渠道类型',
}) => {
  const { selectedChannelTypes, setChannelTypes } = useFilterStore();
  const { channelTypes } = useAppMarketFilterOptionSets();

  const handleChange = (values: string[]) => {
    setChannelTypes(values);
    onChange?.(values);
  };

  return (
    <Select
      mode="multiple"
      value={selectedChannelTypes}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear={allowClear}
      style={{ minWidth: 180 }}
      maxTagCount="responsive"
    >
      {channelTypes.map((type) => (
        <Option key={type.value} value={type.value}>
          {type.label}
        </Option>
      ))}
    </Select>
  );
};

export default ChannelTypeFilter;
