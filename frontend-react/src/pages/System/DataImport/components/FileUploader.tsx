/**
 * 文件上传组件
 */
import { useState, useRef, useEffect } from 'react';
import { Upload, message, Progress, Switch, Space, Spin } from 'antd';
import type { UploadProps } from 'antd/es/upload/interface';
import { InboxOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadResponse } from '@/types/api.schemas';
import { http } from '@/services/http'; // feat-local-auth：用 http 客户端自动带 Authorization
import ImportResult from './ImportResult';
import styles from './FileUploader.module.scss';
import type { DataType } from '../constants';

const { Dragger } = Upload;

interface FileUploaderProps {
  dataType: DataType;
  onImportSuccess: () => void;
}

// 任务状态响应类型
interface TaskStatusData {
  task_id: string;
  import_type: string;
  import_type_name: string;
  file_name: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  total_rows: number | null;
  processed_rows: number | null;
  inserted_rows: number | null;
  updated_rows: number | null;
  failed_rows: number | null;
  quality_score: number | null;
  error_code?: string;
  error_message?: string;
}

interface TaskStatusResponse {
  success: boolean;
  data: TaskStatusData;
  message?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ dataType, onImportSuccess }) => {
  const [overwrite, setOverwrite] = useState(true); // 默认全量替换
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 应用市场下载链路（1-6月 / 7-9月 / 10-12月）区间拆分类型：只按区间替换，隐藏全量替换开关
  const isAppmarketPeriod = dataType.startsWith('conversion_appmarket_');
  const isBaseAppmarket = dataType === 'conversion_appmarket';

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string): Promise<TaskStatusResponse> => {
    // feat-local-auth：用 http 客户端自动带 Authorization 头，避免 401
    const resp = await http.get<TaskStatusData>(`/status/${taskId}`);
    return {
      success: resp.success,
      data: resp.data as TaskStatusData,
      message: resp.message,
    };
  };

  // 将任务状态响应转换为导入结果格式
  const convertToUploadResult = (statusData: TaskStatusData): UploadResponse => {
    const isSuccess = statusData.status === 'completed';
    const insertedRows = statusData.inserted_rows || 0;
    const updatedRows = statusData.updated_rows || 0;
    const failedRows = statusData.failed_rows || 0;
    const totalRows = statusData.total_rows || 0;

    return {
      success: isSuccess,
      message: statusData.message || (isSuccess ? '导入完成' : '导入失败'),
      data: {
        total_rows: totalRows,
        success_count: insertedRows + updatedRows,
        failed_count: failedRows,
        errors: statusData.error_message ? [statusData.error_message] : [],
      },
    };
  };

  // 开始轮询任务状态
  const startPolling = async (taskId: string) => {
    const pollInterval = 1000; // 1秒轮询一次
    const maxAttempts = 300; // 最多轮询5分钟
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const statusResponse = await pollTaskStatus(taskId);

        if (!statusResponse.success || !statusResponse.data) {
          clearInterval(pollingRef.current!);
          setUploading(false);
          message.error('获取任务状态失败');
          return;
        }

        const { data } = statusResponse;
        setStatusMessage(data.message || '正在处理...');

        // 更新进度条
        if (data.progress !== null) {
          setProgress(data.progress);
        }

        // 检查任务是否完成
        if (data.status === 'completed') {
          clearInterval(pollingRef.current!);
          setUploading(false);
          setProgress(100);

          const uploadResult = convertToUploadResult(data);
          setResult(uploadResult);
          message.success(`导入成功！共 ${uploadResult.data?.success_count || 0} 条数据`);
          onImportSuccess();
        } else if (data.status === 'failed') {
          clearInterval(pollingRef.current!);
          setUploading(false);

          const uploadResult = convertToUploadResult(data);
          setResult(uploadResult);
          message.error(data.error_message || '导入失败');
        } else if (attempts >= maxAttempts) {
          // 超时处理
          clearInterval(pollingRef.current!);
          setUploading(false);
          message.error('导入超时，请稍后刷新页面查看结果');
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error);
        if (attempts >= maxAttempts) {
          clearInterval(pollingRef.current!);
          setUploading(false);
          message.error('获取任务状态失败');
        }
      }
    };

    // 立即执行一次
    await poll();
    // 设置定时轮询
    pollingRef.current = setInterval(poll, pollInterval);
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    customRequest: async (options: any) => {
      const { file } = options;
      setUploading(true);
      setProgress(0);
      setResult(null);
      setStatusMessage('正在上传文件...');

      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('data_type', dataType);
      formData.append('auto_process', 'true');
      formData.append('overwrite', String(overwrite));

      try {
        // feat-local-auth：用 http.upload 自动带 Authorization 头，避免 401
        const resp = await http.upload<{ task_id?: string; success_count?: number } & UploadResponse['data']>(
          '/upload',
          formData
        );

        if (resp.success && resp.data?.task_id) {
          // 后端返回了任务ID，开始轮询
          setStatusMessage('文件上传成功，正在处理...');
          setProgress(10);
          await startPolling(resp.data.task_id);
        } else if (resp.success && resp.data?.success_count !== undefined) {
          // 同步返回结果（兼容旧模式）
          setUploading(false);
          setProgress(100);
          setResult(resp as unknown as UploadResponse);
          message.success(`导入成功！共 ${resp.data?.success_count || 0} 条数据`);
          onImportSuccess();
        } else {
          // 上传失败
          setUploading(false);
          setResult(resp as unknown as UploadResponse);
          message.error(resp.message || '上传失败');
        }
      } catch {
        message.error('上传失败，请检查网络');
        setUploading(false);
      }
    },
  };

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.uploader}>
      <div className={styles.options}>
        {isAppmarketPeriod ? (
          <span className={styles.hint}>
            按所选区间替换该时段数据（不影响其它月份）；请确保上传文件仅含本区间数据
          </span>
        ) : (
          <Space>
            <span>全量替换:</span>
            <Switch checked={overwrite} onChange={setOverwrite} />
            <span className={styles.hint}>
              {isBaseAppmarket
                ? '开启后清空旧数据再导入；关闭后按设备号+下载日期增量追加'
                : '仅应用市场转化明细支持增量追加'}
            </span>
          </Space>
        )}
      </div>

      <Dragger {...uploadProps} disabled={uploading} className={styles.dragger}>
        <p className="ant-upload-drag-icon">
          {uploading ? <LoadingOutlined /> : <InboxOutlined />}
        </p>
        <p className="ant-upload-text">
          {uploading ? '正在导入，请稍候...' : '点击或拖拽文件到此区域上传'}
        </p>
        <p className="ant-upload-hint">支持 .xlsx, .xls, .csv 格式</p>
      </Dragger>

      {uploading && (
        <div className={styles.progress}>
          <Progress percent={progress} status="active" />
          {statusMessage && (
            <div className={styles.statusMessage}>
              <Spin size="small" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      )}

      {result && <ImportResult result={result} />}
    </div>
  );
};

export default FileUploader;