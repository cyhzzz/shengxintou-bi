/**
 * 数据导入页面
 * 左右两栏布局：左侧按业务域分组的数据类型菜单，右侧上传区
 * 应用市场下载链路合并为一项，选择后用 Segmented 切换区间（1-6月/7-9月/10-12月）
 */
import React, { useState } from 'react';
import { Typography, Alert, Segmented, Tag, Card } from 'antd';
import DataTypeSelector from './components/DataTypeSelector';
import FileUploader from './components/FileUploader';
import { DataFreshnessIndicator } from '@/components/DataFreshness';
import {
  DATA_TYPES,
  APPMARKET_PREFIX,
  APPMARKET_INTERVALS,
  type DataType,
} from './constants';
import styles from './index.module.scss';

const { Title } = Typography;

const DataImportPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<DataType>('vendor_daily');
  const [refreshKey, setRefreshKey] = useState(0);

  const isAppmarket = selectedType.startsWith(APPMARKET_PREFIX);
  const selectedTypeInfo = DATA_TYPES.find((t) => t.type === selectedType);

  const displayTitle = isAppmarket
    ? selectedTypeInfo?.label.replace(/(\(1-6月\)|\(7-9月\)|\(10-12月\))/, '') ?? '应用市场下载链路'
    : selectedTypeInfo?.label ?? '';

  const handleImportSuccess = () => {
    // 刷新数据新鲜度组件
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className={styles.dataImportPage}>
      <Title level={3} className={styles.pageTitle}>
        数据导入
      </Title>

      {/* 数据新鲜度状态卡片（保持原样，默认收起，仅在有严重警告时展开） */}
      <Card className={styles.freshnessCard} size="small">
        <DataFreshnessIndicator
          key={refreshKey}
          showActions={false}
          compact={true}
        />
      </Card>

      <Alert
        title="导入须知"
        description="请确保上传的文件格式正确，第一行为表头。点击数据类型右侧的 ? 图标可查看详细导入说明。大数据量导入可能需要较长时间，请耐心等待。"
        type="info"
        showIcon
        className={styles.notice}
      />

      <div className={styles.body}>
        {/* 左侧：数据类型选择 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>选择数据类型</span>
          </div>
          <DataTypeSelector selected={selectedType} onChange={setSelectedType} />
        </div>

        {/* 右侧：上传区 */}
        <div className={styles.rightPanel}>
          <div className={styles.uploadHeader}>
            <div className={styles.uploadTitleGroup}>
              <span className={styles.uploadTitle}>{displayTitle}</span>
              {selectedTypeInfo && (
                <Tag className={styles.tableTag}>
                  {selectedTypeInfo.targetTables.join(' + ')}
                </Tag>
              )}
            </div>

            {isAppmarket && (
              <Segmented
                value={selectedType}
                options={APPMARKET_INTERVALS.map((i) => ({
                  label: i.label,
                  value: i.type,
                }))}
                onChange={(v) => setSelectedType(v as DataType)}
                className={styles.intervalSegmented}
              />
            )}

            <span className={styles.uploadDesc}>
              数据源自省心投系统导出，二次导入分析（数据落库后由本平台做查询/聚合/可视化，不在本页做任何业务计算）
            </span>
          </div>

          <FileUploader dataType={selectedType} onImportSuccess={handleImportSuccess} />
        </div>
      </div>
    </div>
  );
};

export default DataImportPage;