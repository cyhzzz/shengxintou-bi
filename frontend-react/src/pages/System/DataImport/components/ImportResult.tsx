/**
 * 导入结果展示组件
 */
import React from 'react';
import { Alert, Typography, Collapse, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { UploadResponse } from '@/types/api.schemas';
import styles from './ImportResult.module.scss';

const { Text } = Typography;
const { Panel } = Collapse;

interface ImportResultProps {
  result: UploadResponse;
}

const ImportResult: React.FC<ImportResultProps> = ({ result }) => {
  const { success, message, data } = result;

  if (!data) return null;

  const hasErrors = data.failed_count > 0;

  return (
    <div className={styles.result}>
      <Alert
        message={success ? '导入完成' : '导入失败'}
        description={
          <div className={styles.summary}>
            <div className={styles.statRow}>
              <Tag color="blue">总行数: {data.total_rows}</Tag>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                成功: {data.success_count}
              </Tag>
              {hasErrors && (
                <Tag color="error" icon={<CloseCircleOutlined />}>
                  失败: {data.failed_count}
                </Tag>
              )}
            </div>
          </div>
        }
        type={success ? 'success' : 'error'}
        showIcon
        style={{ marginBottom: 16 }}
      />

      {hasErrors && data.errors.length > 0 && (
        <Collapse className={styles.errorCollapse}>
          <Panel header={`错误详情 (${data.errors.length} 条)`} key="errors">
            <div className={styles.errorList}>
              {data.errors.map((error, index) => (
                <div key={index} className={styles.errorItem}>
                  <Text type="danger">{error}</Text>
                </div>
              ))}
            </div>
          </Panel>
        </Collapse>
      )}
    </div>
  );
};

export default ImportResult;