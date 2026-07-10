/**
 * 数据同步页面
 * 实现坚果云数据库备份/恢复功能
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Space, Table, Modal, message, Alert } from 'antd';
import { CloudUploadOutlined, CloudDownloadOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import BackupProgress from './components/BackupProgress';
import VersionUpdateModal from './components/VersionUpdateModal';
import { http } from '@/services/http';
import type {
  WebdavBackupFile,
  WebdavProgressResponse,
  VersionCompareResponse,
} from '@/types/api.schemas';
import styles from './index.module.scss';

const DatabaseBackupPage: React.FC = () => {
  const [backupList, setBackupList] = useState<WebdavBackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);
  const [progress, setProgress] = useState({ status: '', progress: 0, message: '' });
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    message: string;
    cloudVersion?: string;
    supportContact?: string;
  } | null>(null);

  const taskIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBackupList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get<WebdavBackupFile[]>('/webdav/list');
      if (response.success) {
        setBackupList(response.data || []);
      } else {
        message.error(response.message || '获取备份列表失败');
      }
    } catch {
      message.error('获取备份列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const response = await http.get<VersionCompareResponse['data']>('/version/compare');
      if (response.success && response.data?.needs_update) {
        setVersionInfo({
          message: response.data.message || '',
          cloudVersion: response.data.cloud_version,
          supportContact: response.data.support_contact,
        });
        setVersionModalVisible(true);
      }
    } catch (err) {
      // 版本检查失败不影响正常使用
      console.error('检查版本更新失败:', err);
    }
  }, []);

  useEffect(() => {
    loadBackupList();
    checkVersion();
  }, [loadBackupList, checkVersion]);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startPolling = (taskId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await http.get<WebdavProgressResponse['data']>(
          `/webdav/progress/${taskId}`
        );
        if (response.success && response.data) {
          setProgress({
            status: response.data.status,
            progress: response.data.progress,
            message: response.data.message,
          });

          if (response.data.status === 'completed' || response.data.status === 'failed') {
            stopPolling();
            setTimeout(() => {
              setProgressVisible(false);
              if (response.data.status === 'completed') {
                message.success('操作完成');
              }
              loadBackupList();
            }, 2000);
          }
        }
      } catch (err) {
        console.error('查询进度失败:', err);
      }
    }, 1000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleBackup = async () => {
    try {
      const response = await http.post<{ task_id: string }>('/webdav/backup', {
        description: '',
      });

      if (response.success && response.data?.task_id) {
        taskIdRef.current = response.data.task_id;
        setProgress({ status: 'pending', progress: 0, message: '' });
        setProgressVisible(true);
        startPolling(response.data.task_id);
      } else {
        message.error('启动备份失败: ' + (response.message || '未知错误'));
      }
    } catch {
      message.error('备份失败');
    }
  };

  const handleTest = async () => {
    try {
      const response = await http.get<{ success: boolean; status_code?: number; message?: string }>('/webdav/test');
      if (response.success && response.data?.success) {
        message.success(`连接正常（HTTP ${response.data.status_code ?? ''}）`);
      } else {
        message.error('连接异常：' + (response.data?.message || response.message || '未知错误'));
      }
    } catch {
      message.error('连接测试失败');
    }
  };

  const handleRestore = async (filename: string) => {
    Modal.confirm({
      title: '确认恢复',
      content: `确定要恢复备份 "${filename}" 吗？恢复前会自动备份当前数据库。`,
      onOk: async () => {
        try {
          const response = await http.post<{ task_id: string }>('/webdav/restore', {
            filename,
          });

          if (response.success && response.data?.task_id) {
            taskIdRef.current = response.data.task_id;
            setProgress({ status: 'pending', progress: 0, message: '' });
            setProgressVisible(true);
            startPolling(response.data.task_id);
          } else {
            message.error('启动恢复失败: ' + (response.message || '未知错误'));
          }
        } catch {
          message.error('恢复失败');
        }
      },
    });
  };

  const handleDelete = async (filename: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除备份 "${filename}" 吗？`,
      onOk: async () => {
        try {
          const response = await http.post<void>('/webdav/delete', {
            filename,
          });

          if (response.success) {
            message.success('删除成功');
            loadBackupList();
          } else {
            message.error('删除失败: ' + (response.message || '未知错误'));
          }
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number, record: WebdavBackupFile) => {
        const isCompressed = record.filename.endsWith('.db.gz');
        return (
          <span>
            {formatFileSize(size)}
            {isCompressed && (
              <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)', marginLeft: 8 }}>
                (压缩)
              </span>
            )}
          </span>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created',
      key: 'created',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: WebdavBackupFile) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleRestore(record.filename)}
          >
            恢复
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.filename)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.databaseBackupPage}>
      <Card>
        <div className={styles.header}>
          <h3>坚果云数据库备份</h3>
        </div>

        {/* 操作按钮 */}
        <Space style={{ marginBottom: 24 }}>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={handleBackup}
            disabled={progressVisible}
          >
            备份数据库到坚果云
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadBackupList}
            disabled={progressVisible}
          >
            刷新备份列表
          </Button>
          <Button
            onClick={handleTest}
            disabled={progressVisible}
          >
            测试连接
          </Button>
        </Space>

        {/* 进度显示 */}
        {progressVisible && (
          <BackupProgress
            status={progress.status}
            progress={progress.progress}
            message={progress.message}
          />
        )}

        {/* 备份列表 */}
        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 12 }}>备份历史</h4>
          <Table
            columns={columns}
            dataSource={backupList}
            rowKey="filename"
            loading={loading}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无备份' }}
          />
        </div>

        {/* 使用说明 */}
        <Alert
          style={{ marginTop: 24 }}
          type="info"
          title="使用说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                <strong>备份数据库到坚果云</strong>：将整个数据库文件上传到坚果云网盘
              </li>
              <li>
                <strong>从坚果云恢复数据库</strong>：从坚果云下载备份文件并恢复（恢复前会自动备份当前数据库）
              </li>
              <li>保留最近10个备份，旧备份会自动删除</li>
            </ul>
          }
        />
      </Card>

      {/* 版本更新弹窗 */}
      <VersionUpdateModal
        visible={versionModalVisible}
        message={versionInfo?.message || ''}
        cloudVersion={versionInfo?.cloudVersion}
        supportContact={versionInfo?.supportContact}
        onClose={() => setVersionModalVisible(false)}
      />
    </div>
  );
};

export default DatabaseBackupPage;