/**
 * 数据导入页面
 * 数据类型选择使用卡片网格布局，指南通过角标访问
 */
import React, { useState } from 'react';
import { Card, Typography, Alert, Space } from 'antd';
import DataTypeSelector from './components/DataTypeSelector';
import FileUploader from './components/FileUploader';
import { DataFreshnessIndicator } from '@/components/DataFreshness';
import { DATA_TYPES, type DataType } from './constants';
import styles from './index.module.scss';

const { Title, Text } = Typography;

const DataImportPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<DataType>('vendor_daily');
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedTypeInfo = DATA_TYPES.find((t) => t.type === selectedType);

  const handleImportSuccess = () => {
    // 刷新数据新鲜度组件
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className={styles.dataImportPage}>
      <Title level={3}>数据导入</Title>

      {/* 数据新鲜度状态卡片 */}
      <Card className={styles.freshnessCard} size="small">
        <DataFreshnessIndicator
          key={refreshKey}
          showActions={false}
          compact={true}  // 紧凑模式，只显示一行
        />
      </Card>

      <Alert
        title="导入须知"
        description="请确保上传的文件格式正确，第一行为表头。点击数据类型卡片右上角的 ? 图标可查看详细导入指南。大数据量导入可能需要较长时间，请耐心等待。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card className={styles.selectorCard} size="small">
          <div className={styles.cardHeader}>
            <Text type="secondary" className={styles.cardTitle}>
              选择数据类型
            </Text>
            <Text type="secondary" className={styles.cardDesc}>
              选择要导入的数据类型（点击右上角 ? 查看字段说明）
            </Text>
          </div>
          <DataTypeSelector selected={selectedType} onChange={setSelectedType} />
        </Card>

        <Card className={styles.uploadCard} size="small">
          <div className={styles.cardHeader}>
            <Text type="secondary" className={styles.cardTitle}>
              上传文件
            </Text>
            <Text type="secondary" className={styles.cardDesc}>
              {selectedTypeInfo?.label} - 数据源自省心投系统导出，二次导入分析（数据落库后由本平台做查询/聚合/可视化，不在本页做任何业务计算）
            </Text>
          </div>
          <FileUploader dataType={selectedType} onImportSuccess={handleImportSuccess} />
        </Card>
      </Space>
    </div>
  );
};

export default DataImportPage;