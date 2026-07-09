/**
 * 代理商筛选器组件
 * 多选代理商筛选
 */
import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { useFilterStore } from '@/stores';
import { metadataService } from '@/services';

const { Option } = Select;

interface AgencyFilterProps {
  onChange?: (agencies: string[]) => void;
  allowClear?: boolean;
  placeholder?: string;
}

const AgencyFilter: React.FC<AgencyFilterProps> = ({
  onChange,
  allowClear = true,
  placeholder = '选择代理商',
}) => {
  const { selectedAgencies, setAgencies } = useFilterStore();
  const [agencyOptions, setAgencyOptions] = useState<{value: string; label: string}[]>([]);

  // 加载代理商列表
  useEffect(() => {
    const loadAgencies = async () => {
      const response = await metadataService.getMetadata();
      if (response.success && response.data) {
        setAgencyOptions(response.data.agencies);
      }
    };
    loadAgencies();
  }, []);

  const handleChange = (values: string[]) => {
    setAgencies(values);
    onChange?.(values);
  };

  return (
    <Select
      mode="multiple"
      value={selectedAgencies}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear={allowClear}
      style={{ minWidth: 200 }}
      maxTagCount="responsive"
    >
      {agencyOptions.map((agency) => (
        <Option key={agency} value={agency}>
          {agency}
        </Option>
      ))}
    </Select>
  );
};

export default AgencyFilter;
