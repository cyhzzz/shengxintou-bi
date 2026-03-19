/**
 * 简单日期范围选择器
 * 用于不需要快速选择按钮的场景
 */
import React from 'react';
import { DatePicker } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface DateRangePickerProps {
  value: [string, string] | null;
  onChange: (dates: [string, string]) => void;
  placeholder?: [string, string];
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = ['开始日期', '结束日期'],
}) => {
  // 将字符串日期转换为 Dayjs 对象，处理 null 值
  const dayjsValue: [Dayjs | null, Dayjs | null] = value
    ? [value[0] ? dayjs(value[0]) : null, value[1] ? dayjs(value[1]) : null]
    : [null, null];

  // 处理日期变化
  const handleChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      onChange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
    } else {
      onChange(['', '']);
    }
  };

  return (
    <RangePicker
      value={dayjsValue}
      onChange={handleChange}
      placeholder={placeholder}
      allowClear
      style={{ width: 260 }}
      suffixIcon={<CalendarOutlined />}
    />
  );
};

export default DateRangePicker;