/**
 * 海报导出按钮组件
 */
import React, { useState } from 'react';
import { Button, Space, message } from 'antd';
import { PictureOutlined, DownloadOutlined } from '@ant-design/icons';
import type { EmployeeConversionWeeklyData } from '@/types/api.schemas';
import styles from './PosterExportButtons.module.scss';

interface PosterExportButtonsProps {
  reportData: EmployeeConversionWeeklyData;
  dateRange: [string, string];
}

const PosterExportButtons: React.FC<PosterExportButtonsProps> = ({
  reportData,
  dateRange,
}) => {
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(null);

  // 导出海报
  const handleExportPoster = async (platform: string) => {
    setExportingPlatform(platform);
    try {
      // TODO: 实现海报导出逻辑
      // 这里可以使用 html2canvas 或其他库生成海报
      message.info(`${platform}平台海报导出功能开发中...`);
    } catch (error) {
      console.error('导出海报失败:', error);
      message.error('导出海报失败，请重试');
    } finally {
      setExportingPlatform(null);
    }
  };

  // 获取有数据的平台列表
  const platformsWithData = reportData?.overview
    ? Object.keys(reportData.overview).filter(
        platform => reportData.overview[platform]?.leads > 0
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
            onClick={() => handleExportPoster(platform)}
            loading={exportingPlatform === platform}
          >
            {platform}海报
          </Button>
        ))}
      </Space>
    </div>
  );
};

export default PosterExportButtons;