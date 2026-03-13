/**
 * 数据类型选择器组件
 */
import React from 'react';
import { Radio, Space } from 'antd';
import { FileExcelOutlined, FileTextOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { DATA_TYPES, type DataType } from '@/types/api.schemas';
import styles from './DataTypeSelector.module.scss';

interface DataTypeSelectorProps {
  selected: DataType;
  onChange: (type: DataType) => void;
}

const getIcon = (type: DataType) => {
  if (type === 'conversion') return <FileTextOutlined />;
  if (type.startsWith('xhs_')) return <CloudUploadOutlined />;
  return <FileExcelOutlined />;
};

const DataTypeSelector: React.FC<DataTypeSelectorProps> = ({ selected, onChange }) => {
  return (
    <div className={styles.selector}>
      <Radio.Group
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className={styles.radioGroup}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {DATA_TYPES.map((type) => (
            <Radio.Button
              key={type.type}
              value={type.type}
              className={selected === type.type ? styles.activeButton : styles.radioButton}
            >
              <div className={styles.optionContent}>
                <span className={styles.icon}>{getIcon(type.type)}</span>
                <span className={styles.label}>{type.label}</span>
              </div>
            </Radio.Button>
          ))}
        </Space>
      </Radio.Group>
    </div>
  );
};

export default DataTypeSelector;