/**
 * 数据类型选择器组件
 * 卡片网格布局，每个卡片带角标指南图标
 */
import React, { useState } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { DATA_TYPES, type DataType } from '../constants';
import { GuideModal } from '@/components';
import styles from './DataTypeSelector.module.scss';

// 数据类型到指南文件的映射
const GUIDE_FILE_MAP: Record<DataType, string> = {
  tencent_ads: 'tencent_ads_guide.md',
  douyin_ads: 'douyin_ads_guide.md',
  xiaohongshu_ads: 'xiaohongshu_ads_guide.md',
  xhs_notes_list: 'xhs_notes_list_guide.md',
  xhs_notes_daily: 'xhs_notes_daily_guide.md',
  xhs_notes_content_daily: 'xhs_notes_content_guide.md',
  backend_conversion: 'backend_conversion_guide.md',
};

// 数据类型到图标的映射
const TYPE_ICONS: Record<DataType, string> = {
  tencent_ads: '🅰️',
  douyin_ads: '🎵',
  xiaohongshu_ads: '📕',
  xhs_notes_list: '📝',
  xhs_notes_daily: '📊',
  xhs_notes_content_daily: '📈',
  backend_conversion: '🔄',
};

interface DataTypeSelectorProps {
  selected: DataType;
  onChange: (type: DataType) => void;
}

const DataTypeSelector: React.FC<DataTypeSelectorProps> = ({ selected, onChange }) => {
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [currentGuideFile, setCurrentGuideFile] = useState<string>('');

  const handleGuideClick = (e: React.MouseEvent, type: DataType) => {
    e.stopPropagation(); // 阻止事件冒泡到卡片
    setCurrentGuideFile(GUIDE_FILE_MAP[type]);
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
              className={styles.guideBtn}
              onClick={(e) => handleGuideClick(e, type.type)}
              title="查看导入说明"
            >
              <QuestionCircleOutlined />
            </button>
            <div className={styles.cardIcon}>{TYPE_ICONS[type.type]}</div>
            <h4 className={styles.cardTitle}>{type.label}</h4>
            <p className={styles.cardDesc}>{type.description}</p>
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