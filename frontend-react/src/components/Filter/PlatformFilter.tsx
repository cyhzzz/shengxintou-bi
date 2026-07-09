/**
 * 平台筛选器组件
 * 多选平台筛选
 */
import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { useFilterStore } from '@/stores';
import { metadataService } from '@/services';

const { Option } = Select;

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
  const [platformOptions, setPlatformOptions] = useState<{value: string; label: string}[]>([]);

  // 加载平台列表
  useEffect(() => {
    const loadPlatforms = async () => {
      const response = await metadataService.getMetadata();
      if (response.success && response.data) {
        setPlatformOptions(response.data.platforms);
      }
    };
    loadPlatforms();
  }, []);

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
      {platformOptions.map((platform) => (
        <Option key={platform} value={platform}>
          {platform}
        </Option>
      ))}
    </Select>
  );
};

export default PlatformFilter;
