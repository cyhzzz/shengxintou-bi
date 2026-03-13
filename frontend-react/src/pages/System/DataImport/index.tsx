/**
 * 数据导入页面
 */
import React, { useState } from 'react';
import { Card, Row, Col, Typography, Alert, Collapse } from 'antd';
import DataTypeSelector from './components/DataTypeSelector';
import FileUploader from './components/FileUploader';
import { DataFreshnessIndicator } from '@/components/DataFreshness';
import { DATA_TYPES, type DataType } from '@/types/api.schemas';
import styles from './index.module.scss';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const DataImportPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<DataType>('tencent_ads');
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
        />
      </Card>

      <Alert
        message="导入须知"
        description="请确保上传的文件格式正确，第一行为表头。大数据量导入可能需要较长时间，请耐心等待。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={24}>
        <Col xs={24} lg={8}>
          <Card className={styles.selectorCard}>
            <Title level={4}>选择数据类型</Title>
            <DataTypeSelector selected={selectedType} onChange={setSelectedType} />
          </Card>

          <Card className={styles.guideCard}>
            <Title level={4}>导入指南</Title>
            <Collapse accordion>
              {DATA_TYPES.map((type) => (
                <Panel header={type.label} key={type.type}>
                  <Paragraph>{type.description}</Paragraph>
                  <Paragraph>
                    <Text strong>必需字段：</Text>
                    {type.requiredFields.join('、')}
                  </Paragraph>
                </Panel>
              ))}
            </Collapse>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className={styles.uploadCard}>
            <Title level={4}>上传文件 - {selectedTypeInfo?.label}</Title>
            <FileUploader dataType={selectedType} onImportSuccess={handleImportSuccess} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DataImportPage;