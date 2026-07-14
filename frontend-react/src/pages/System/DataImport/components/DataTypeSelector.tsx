/**
 * 数据类型选择器组件（v2 - 6 个新 type）
 * 卡片网格布局，每个卡片带角标指南图标
 */
import React, { useState } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { DATA_TYPES, type DataType } from '../constants';
import { GuideModal } from '@/components';
import styles from './DataTypeSelector.module.scss';

interface DataTypeSelectorProps {
  selected: DataType;
  onChange: (type: DataType) => void;
}

const DataTypeSelector: React.FC<DataTypeSelectorProps> = ({ selected, onChange }) => {
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [currentGuideFile, setCurrentGuideFile] = useState<string>('');

  const handleGuideClick = (e: React.MouseEvent, type: DataType) => {
    e.stopPropagation();
    setCurrentGuideFile(DATA_TYPES.find((t) => t.type === type)?.guideFile ?? '');
    setGuideModalOpen(true);
  };

  const handleCardClick = (type: DataType) => {
    onChange(type);
  };

  return (
    <>
      <div className={styles.typeGrid}>
        {DATA_TYPES.map((type) => (
          <div
            key={type.type}
            className={`${styles.typeCard} ${selected === type.type ? styles.active : ''}`}
            onClick={() => handleCardClick(type.type)}
          >
            <button
              type="button"
              className={styles.guideBtn}
              onClick={(e) => handleGuideClick(e, type.type)}
              title="查看导入说明"
            >
              <QuestionCircleOutlined />
            </button>
            <div className={styles.cardIcon}>{type.icon}</div>
            <h4 className={styles.cardTitle}>{type.label}</h4>
            <p className={styles.cardDesc}>{type.description}</p>
            <p className={styles.cardTables}>
              <code>{type.targetTables.join(' + ')}</code>
            </p>
          </div>
        ))}
      </div>

      <GuideModal
        open={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        guideFile={currentGuideFile}
      />
    </>
  );
};

export default DataTypeSelector;