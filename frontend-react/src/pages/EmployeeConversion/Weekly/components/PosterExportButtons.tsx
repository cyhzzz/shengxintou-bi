/**
 * 海报导出按钮组件
 * 点击按钮打开模态框展示海报，支持在模态框中导出 PNG 和 PDF
 * 参照旧版前端的海报模板实现
 */
import React, { useState } from 'react';
import { Button, Space } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import type { WeeklyPlatformRankings, WeeklyReportData } from '../weeklyRanking';
import PosterModal from './PosterModal';
import styles from './PosterExportButtons.module.scss';

interface PosterExportButtonsProps {
  reportData: WeeklyReportData;
  dateRange: [string, string];
}

const PosterExportButtons: React.FC<PosterExportButtonsProps> = ({
  reportData,
  dateRange,
}) => {
  // 当前选中的平台
  const [currentPlatform, setCurrentPlatform] = useState<string>('');
  // 模态框是否可见
  const [modalVisible, setModalVisible] = useState(false);

  // 获取平台对应的榜单数据
  const getRankingsForPlatform = (platform: string): WeeklyPlatformRankings => {
    const rankings = reportData?.rankings?.[platform];
    return {
      total: rankings?.total || [],
      existing: rankings?.existing || [],
      new: rankings?.new || [],
    };
  };

  // 打开海报模态框
  const handleOpenPoster = (platform: string) => {
    setCurrentPlatform(platform);
    setModalVisible(true);
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setModalVisible(false);
    setCurrentPlatform('');
  };

  // 获取有数据的平台列表
  const platformsWithData = reportData?.overview
    ? Object.keys(reportData.overview).filter(
        platform => (reportData.overview[platform]?.leads ?? 0) > 0
      )
    : [];

  if (platformsWithData.length === 0) {
    return null;
  }

  return (
    <div className={styles.posterButtons}>
      <Space wrap>
        {platformsWithData.map(platform => (
          <Button
            key={platform}
            icon={<PictureOutlined />}
            onClick={() => handleOpenPoster(platform)}
          >
            {platform}海报
          </Button>
        ))}
      </Space>

      {/* 海报模态框 */}
      <PosterModal
        open={modalVisible}
        platform={currentPlatform}
        startDate={dateRange[0]}
        endDate={dateRange[1]}
        rankings={getRankingsForPlatform(currentPlatform)}
        onCancel={handleCloseModal}
      />
    </div>
  );
};

export default PosterExportButtons;
