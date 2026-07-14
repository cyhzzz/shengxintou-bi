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

// 快速选择选项（与原始UI保持一致）
const quickOptions = [
  { label: '全部', days: 0 },      // 0 表示全部日期
  { label: '近7天', days: 7 },
  { label: '近30天', days: 30 },
  { label: '近90天', days: 90 },
];

interface DateRangeFilterProps {
  onChange?: (startDate: string, endDate: string) => void;
  showQuickSelect?: boolean;
  defaultDays?: number;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  onChange,
  showQuickSelect = true,
  defaultDays = 0,  // 默认选中"全部"
}) => {
  const { dateRange, setDateRange, setQuickDateRange } = useFilterStore();
  // 从持久化的 store 状态派生初始高亮按钮，避免跨页面导航后高亮与实际范围不一致
  const [activeQuick, setActiveQuick] = useState<number | null>(() => {
    if (dateRange.startDate === '2020-01-01') return 0; // "全部"
    const today = dayjs();
    const startDiff = today.diff(dayjs(dateRange.startDate), 'day');
    const endDiff = today.diff(dayjs(dateRange.endDate), 'day');
    if (endDiff === 0 && [7, 30, 90].includes(startDiff)) return startDiff;
    return null; // 自定义范围
  });

  // 处理快速选择
  const handleQuickSelect = (days: number) => {
    setActiveQuick(days);

    if (days === 0) {
      // "全部" - 使用一个很宽的日期范围来获取所有数据
      const start = '2020-01-01';  // 一个足够早的日期
      const end = dayjs().format('YYYY-MM-DD');
      setDateRange({ startDate: start, endDate: end });
      onChange?.(start, end);
    } else {
      setQuickDateRange(days);
      const start = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
      const end = dayjs().format('YYYY-MM-DD');
      onChange?.(start, end);
    }
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