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
  /** 外部传入的平台选项（优先使用，缺省时从 /api/v1/metadata 加载） */
  options?: { value: string; label: string }[];
}

const PlatformFilter: React.FC<PlatformFilterProps> = ({
  onChange,
  allowClear = true,
  placeholder = '选择平台',
  options,
}) => {
  const { selectedPlatforms, setPlatforms } = useFilterStore();
  const [platformOptions, setPlatformOptions] = useState<{value: string; label: string}[]>([]);

  // 外部传入 options 时优先使用；否则从 metadata 加载平台列表
  useEffect(() => {
    if (options && options.length > 0) {
      setPlatformOptions(options);
      return;
    }
    const loadPlatforms = async () => {
      const response = await metadataService.getMetadata();
      if (response.success && response.data) {
        setPlatformOptions((response.data.platforms || []).map((p: string) => ({ value: p, label: p })));
      }
    };
    loadPlatforms();
  }, [options]);

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
        <Option key={platform.value} value={platform.value}>
          {platform.label}
        </Option>
      ))}
    </Select>
  );
};

export default PlatformFilter;
