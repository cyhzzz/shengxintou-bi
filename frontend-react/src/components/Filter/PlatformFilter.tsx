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
  const [metadataOptions, setMetadataOptions] = useState<{value: string; label: string}[]>([]);

  // 外部传入 options 时优先使用；否则从 metadata 异步加载平台列表
  const platformOptions = (options && options.length > 0) ? options : metadataOptions;

  useEffect(() => {
    if (options && options.length > 0) return;
    let cancelled = false;
    metadataService.getMetadata().then((response) => {
      if (cancelled || !response.success || !response.data) return;
      setMetadataOptions((response.data.platforms || []).map((p: string) => ({ value: p, label: p })));
    });
    return () => { cancelled = true; };
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
