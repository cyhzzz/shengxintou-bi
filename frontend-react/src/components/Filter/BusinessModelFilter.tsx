/**
 * 业务模式筛选器组件
 * 多选业务模式筛选
 */
import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { useFilterStore } from '@/stores';
import { metadataService } from '@/services';

const { Option } = Select;

interface BusinessModelFilterProps {
  onChange?: (models: string[]) => void;
  allowClear?: boolean;
  placeholder?: string;
}

const BusinessModelFilter: React.FC<BusinessModelFilterProps> = ({
  onChange,
  allowClear = true,
  placeholder = '选择业务模式',
}) => {
  const { selectedBusinessModels, setBusinessModels } = useFilterStore();
  const [businessModelOptions, setBusinessModelOptions] = useState<{value: string; label: string}[]>([]);

  // 加载业务模式列表
  useEffect(() => {
    const loadBusinessModels = async () => {
      const response = await metadataService.getMetadata();
      if (response.success && response.data) {
        setBusinessModelOptions(response.data.business_models);
      }
    };
    loadBusinessModels();
  }, []);

  const handleChange = (values: string[]) => {
    setBusinessModels(values);
    onChange?.(values);
  };

  return (
    <Select
      mode="multiple"
      value={selectedBusinessModels}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear={allowClear}
      style={{ minWidth: 160 }}
      maxTagCount="responsive"
    >
      {businessModelOptions.map((model) => (
        <Option key={model} value={model}>
          {model}
        </Option>
      ))}
    </Select>
  );
};

export default BusinessModelFilter;
