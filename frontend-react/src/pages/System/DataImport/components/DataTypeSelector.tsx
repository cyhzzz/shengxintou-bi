/**
 * 数据类型选择器组件（v2 - 10 个 type + 占位项，按业务域分组）
 * 紧凑纵向菜单列表：每项 = 图标 + 名称 + 指南入口
 * 应用市场下载链路 3 个区间在 UI 上合并为一项，具体区间在右侧上传区切换
 * 占位数据源（如 手机号明细数据）以「开发中」禁用展示
 */
import React, { useState } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import {
  DATA_TYPES,
  DATA_GROUPS,
  PLACEHOLDER_ITEMS,
  APPMARKET_PREFIX,
  APPMARKET_DOWNLOAD_TYPE,
  type DataType,
  type DataTypeConfig,
} from '../constants';
import { GuideModal } from '@/components';
import styles from './DataTypeSelector.module.scss';

interface DataTypeSelectorProps {
  selected: DataType;
  onChange: (type: DataType) => void;
}

const DataTypeSelector: React.FC<DataTypeSelectorProps> = ({ selected, onChange }) => {
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideFile, setGuideFile] = useState('');
  const [guideTitle, setGuideTitle] = useState('');

  const openGuide = (cfg: DataTypeConfig) => {
    setGuideFile(cfg.guideFile);
    setGuideTitle(cfg.label);
    setGuideModalOpen(true);
  };

  const isAppmarketActive = selected.startsWith(APPMARKET_PREFIX);
  const appmarketCfg = DATA_TYPES.find((t) => t.type === APPMARKET_DOWNLOAD_TYPE)!;

  const renderItem = (cfg: DataTypeConfig) => {
    const active = selected === cfg.type;
    const Icon = cfg.icon;
    return (
      <div
        key={cfg.type}
        className={`${styles.item} ${active ? styles.itemActive : ''}`}
        onClick={() => onChange(cfg.type)}
      >
        <span className={styles.itemIcon}>
          <Icon />
        </span>
        <span className={styles.itemLabel}>{cfg.label}</span>
        <button
          type="button"
          className={styles.guideBtn}
          title="查看导入说明"
          onClick={(e) => {
            e.stopPropagation();
            openGuide(cfg);
          }}
        >
          <QuestionCircleOutlined />
        </button>
      </div>
    );
  };

  // 应用市场下载链路：合并为单项（活动状态覆盖 3 个区间 type）
  const renderAppmarketItem = () => {
    const Icon = appmarketCfg.icon;
    return (
      <div
        key="appmarket-downlink"
        className={`${styles.item} ${isAppmarketActive ? styles.itemActive : ''}`}
        onClick={() => onChange(APPMARKET_DOWNLOAD_TYPE)}
      >
        <span className={styles.itemIcon}>
          <Icon />
        </span>
        <span className={styles.itemLabel}>{appmarketCfg.label.replace(/(\(1-6月\)|\(7-9月\)|\(10-12月\))/, '')}</span>
        <button
          type="button"
          className={styles.guideBtn}
          title="查看导入说明"
          onClick={(e) => {
            e.stopPropagation();
            openGuide(appmarketCfg);
          }}
        >
          <QuestionCircleOutlined />
        </button>
      </div>
    );
  };

  // 占位数据源：开发中，不可选择
  const renderPlaceholder = (item: { label: string; icon: React.ComponentType }) => {
    const Icon = item.icon;
    return (
      <div key={`ph-${item.label}`} className={`${styles.item} ${styles.itemDisabled}`}>
        <span className={styles.itemIcon}>
          <Icon />
        </span>
        <span className={styles.itemLabel}>{item.label}</span>
        <Tag color="warning" className={styles.devTag}>
          开发中
        </Tag>
      </div>
    );
  };

  return (
    <>
      <div className={styles.menu}>
        {DATA_GROUPS.map((group) => {
          const normalTypes = DATA_TYPES.filter(
            (t) => t.group === group.key && !t.type.startsWith(APPMARKET_PREFIX)
          );
          const hasAppmarket = DATA_TYPES.some(
            (t) => t.group === group.key && t.type.startsWith(APPMARKET_PREFIX)
          );
          const placeholders = PLACEHOLDER_ITEMS.filter((p) => p.group === group.key);
          if (normalTypes.length === 0 && !hasAppmarket && placeholders.length === 0) return null;

          const GroupIcon = group.icon;
          return (
            <div key={group.key} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupIcon}>
                  <GroupIcon />
                </span>
                <span className={styles.groupLabel}>{group.label}</span>
              </div>
              <div className={styles.groupItems}>
                {normalTypes.map(renderItem)}
                {hasAppmarket && renderAppmarketItem()}
                {placeholders.map(renderPlaceholder)}
              </div>
            </div>
          );
        })}
      </div>

      <GuideModal
        open={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        guideFile={guideFile}
        title={guideTitle}
      />
    </>
  );
};

export default DataTypeSelector;