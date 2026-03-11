/**
 * 日期范围筛选器组件
 * 支持快速选择和自定义日期范围
 */
import React, { useState } from 'react';
import { DatePicker, Space, Button } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useFilterStore } from '@/stores';
import styles from './DateRangeFilter.module.scss';

const { RangePicker } = DatePicker;

// 快速选择选项
const quickOptions = [
  { label: '近7天', days: 7 },
  { label: '近30天', days: 30 },
  { label: '近90天', days: 90 },
  { label: '近180天', days: 180 },
  { label: '近365天', days: 365 },
];

interface DateRangeFilterProps {
  onChange?: (startDate: string, endDate: string) => void;
  showQuickSelect?: boolean;
  defaultDays?: number;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  onChange,
  showQuickSelect = true,
  defaultDays = 30,
}) => {
  const { dateRange, setDateRange, setQuickDateRange } = useFilterStore();
  const [activeQuick, setActiveQuick] = useState<number | null>(defaultDays);

  // 处理快速选择
  const handleQuickSelect = (days: number) => {
    setActiveQuick(days);
    setQuickDateRange(days);
    const start = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    const end = dayjs().format('YYYY-MM-DD');
    onChange?.(start, end);
  };

  // 处理自定义日期选择
  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setActiveQuick(null);
    if (dates && dates[0] && dates[1]) {
      const start = dates[0].format('YYYY-MM-DD');
      const end = dates[1].format('YYYY-MM-DD');
      setDateRange({ startDate: start, endDate: end });
      onChange?.(start, end);
    }
  };

  return (
    <div className={styles.dateRangeFilter}>
      {showQuickSelect && (
        <Space size={4} className={styles.quickSelect}>
          {quickOptions.map((option) => (
            <Button
              key={option.days}
              type={activeQuick === option.days ? 'primary' : 'default'}
              onClick={() => handleQuickSelect(option.days)}
            >
              {option.label}
            </Button>
          ))}
        </Space>
      )}

      <RangePicker
        value={[dayjs(dateRange.startDate), dayjs(dateRange.endDate)]}
        onChange={handleDateChange}
        allowClear={false}
        style={{ width: 280 }}
        suffixIcon={<CalendarOutlined />}
      />
    </div>
  );
};

export default DateRangeFilter;