/**
 * 文件上传组件
 */
import React, { useState } from 'react';
import { Upload, message, Progress, Switch, Space } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { DataType, UploadResponse } from '@/types/api.schemas';
import ImportResult from './ImportResult';
import styles from './FileUploader.module.scss';

const { Dragger } = Upload;

interface FileUploaderProps {
  dataType: DataType;
  onImportSuccess: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ dataType, onImportSuccess }) => {
  const [overwrite, setOverwrite] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResponse | null>(null);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    customRequest: async (options) => {
      const { file } = options;
      setUploading(true);
      setProgress(0);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('data_type', dataType);
      formData.append('auto_process', 'true');
      formData.append('overwrite', String(overwrite));

      try {
        // 模拟进度
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const response = await fetch('/api/v1/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setProgress(100);

        const data: UploadResponse = await response.json();
        setResult(data);

        if (data.success) {
          message.success(`导入成功！共 ${data.data?.success_count || 0} 条数据`);
          onImportSuccess();
        } else {
          message.error(data.message || '导入失败');
        }
      } catch {
        message.error('上传失败，请检查网络');
      } finally {
        setUploading(false);
      }
    },
  };

  return (
    <div className={styles.uploader}>
      <div className={styles.options}>
        <Space>
          <span>覆盖模式:</span>
          <Switch checked={overwrite} onChange={setOverwrite} />
          <span className={styles.hint}>开启后将删除已有数据再导入</span>
        </Space>
      </div>

      <Dragger {...uploadProps} disabled={uploading} className={styles.dragger}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持 .xlsx, .xls, .csv 格式</p>
      </Dragger>

      {uploading && (
        <div className={styles.progress}>
          <Progress percent={progress} status="active" />
        </div>
      )}

      {result && <ImportResult result={result} />}
    </div>
  );
};

export default FileUploader;