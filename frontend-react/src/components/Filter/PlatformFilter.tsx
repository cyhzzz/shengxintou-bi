/**
 * 平台筛选器组件
 * 多选平台筛选
 */
import React from 'react';
import { Select, Space } from 'antd';
import { useFilterStore } from '@/stores';

const { Option } = Select;

// 平台选项
const PLATFORMS = [
  { value: '腾讯', label: '腾讯广告' },
  { value: '抖音', label: '抖音广告' },
  { value: '小红书', label: '小红书' },
];

interface PlatformFilterProps {
  onChange?: (platforms: string[]) => void;
  allowClear?: boolean;
  placeholder?: string;
}

const PlatformFilter: React.FC<PlatformFilterProps> = ({
  onChange,
  allowClear = true,
  placeholder = '选择平台',
}) => {
  const { selectedPlatforms, setPlatforms } = useFilterStore();

  const handleChange = (values: string[]) => {
    setPlatforms(values);
    onChange?.(values);
  };

  return (
    <Select
      mode="multiple"
      value={selectedPlatforms}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear={allowClear}
      style={{ minWidth: 200 }}
      maxTagCount="responsive"
    >
      {PLATFORMS.map((platform) => (
        <Option key={platform.value} value={platform.value}>
          {platform.label}
        </Option>
      ))}
    </Select>
  );
};

export default PlatformFilter;