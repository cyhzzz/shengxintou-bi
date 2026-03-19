/**
 * 服务人员筛选器组件
 * 多选服务人员筛选
 */
import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { useFilterStore } from '@/stores';
import { metadataService } from '@/services';

const { Option } = Select;

interface Employee {
  employee_no: string;
  employee_name: string;
}

interface EmployeeFilterProps {
  onChange?: (employees: string[]) => void;
  allowClear?: boolean;
  placeholder?: string;
}

const EmployeeFilter: React.FC<EmployeeFilterProps> = ({
  onChange,
  allowClear = true,
  placeholder = '选择服务人员',
}) => {
  const { selectedEmployees, setEmployees } = useFilterStore();
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);

  // 加载服务人员列表
  useEffect(() => {
    const loadEmployees = async () => {
      const response = await metadataService.getEmployees();
      if (response.success && response.data) {
        setEmployeeOptions(response.data);
      }
    };
    loadEmployees();
  }, []);

  const handleChange = (values: string[]) => {
    setEmployees(values);
    onChange?.(values);
  };

  return (
    <Select
      mode="multiple"
      value={selectedEmployees}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear={allowClear}
      style={{ minWidth: 200 }}
      maxTagCount="responsive"
      showSearch
      optionFilterProp="children"
    >
      {employeeOptions.map((employee) => (
        <Option key={employee.employee_no} value={employee.employee_no}>
          {employee.employee_name} ({employee.employee_no})
        </Option>
      ))}
    </Select>
  );
};

export default EmployeeFilter;