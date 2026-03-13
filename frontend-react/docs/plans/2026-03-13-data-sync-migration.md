# 数据同步页面迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将原生JS版本的数据同步页面迁移至React前端，实现坚果云数据库备份/恢复功能

**Architecture:** React组件化架构，支持备份、恢复、进度显示、备份历史管理

**Tech Stack:** React 19, TypeScript 5, Ant Design (Table, Progress, Modal, Button, message)

---

## ⚠️ 关键迁移点

### 功能模块

| 模块 | 功能 | API端点 |
|------|------|---------|
| 坚果云备份 | 备份数据库到云端 | POST /api/v1/webdav/backup |
| 坚果云恢复 | 从云端恢复数据库 | POST /api/v1/webdav/restore |
| 备份列表 | 获取备份文件列表 | GET /api/v1/webdav/list |
| 删除备份 | 删除云端备份文件 | POST /api/v1/webdav/delete |
| 进度查询 | 查询备份/恢复进度 | GET /api/v1/webdav/progress/{task_id} |
| 版本检查 | 检查版本更新 | GET /api/v1/version/compare |

### 特殊逻辑

- **任务轮询**: 备份/恢复操作启动后，通过轮询查询进度
- **自动备份**: 恢复前自动备份当前数据库
- **保留策略**: 保留最近10个备份，旧备份自动删除

---

## Task 1: 创建类型定义

**Files:**
- Modify: `src/types/api.schemas.ts`

```typescript
// 数据同步API类型

export interface WebdavBackupResponse {
  success: boolean;
  task_id: string;
  message?: string;
}

export interface WebdavRestoreResponse {
  success: boolean;
  task_id: string;
  message?: string;
}

export interface WebdavBackupFile {
  filename: string;
  size: number;
  created: string;
}

export interface WebdavListResponse {
  success: boolean;
  data: WebdavBackupFile[];
}

export interface WebdavProgressResponse {
  success: boolean;
  data: {
    status: 'pending' | 'uploading' | 'downloading' | 'completed' | 'failed';
    progress: number;
    message: string;
  };
}

export interface WebdavDeleteResponse {
  success: boolean;
  message?: string;
}

export interface VersionCompareResponse {
  success: boolean;
  data: {
    needs_update: boolean;
    message?: string;
    cloud_version?: string;
    support_contact?: string;
  };
}
```

---

## Task 2: 创建进度条组件

**Files:**
- Create: `src/pages/System/DataSync/components/BackupProgress.tsx`

```typescript
/**
 * 备份进度组件
 */
import React from 'react';
import { Progress, Space } from 'antd';

interface BackupProgressProps {
  status: string;
  progress: number;
  message: string;
}

const BackupProgress: React.FC<BackupProgressProps> = ({
  status,
  progress,
  message,
}) => {
  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'uploading':
        return '上传中';
      case 'downloading':
        return '下载中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  const getProgressStatus = (): 'success' | 'exception' | 'active' => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'exception';
    return 'active';
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <Progress
        percent={progress}
        status={getProgressStatus()}
        strokeColor={{
          '0%': '#108ee9',
          '100%': '#87d068',
        }}
      />
      <Space style={{ marginTop: 12 }}>
        <span>状态: <strong>{getStatusText()}</strong></span>
        <span>进度: <strong>{progress}%</strong></span>
        {message && <span style={{ color: '#666' }}>{message}</span>}
      </Space>
    </div>
  );
};

export default BackupProgress;
```

---

## Task 3: 创建版本更新弹窗组件

**Files:**
- Create: `src/pages/System/DataSync/components/VersionUpdateModal.tsx`

```typescript
/**
 * 版本更新提示弹窗
 */
import React from 'react';
import { Modal, Button } from 'antd';

interface VersionUpdateModalProps {
  visible: boolean;
  message: string;
  cloudVersion?: string;
  supportContact?: string;
  onClose: () => void;
}

const VersionUpdateModal: React.FC<VersionUpdateModalProps> = ({
  visible,
  message,
  cloudVersion,
  supportContact,
  onClose,
}) => {
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="ok" type="primary" onClick={onClose}>
          我知道了
        </Button>,
      ]}
      centered
      width={400}
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ marginBottom: 16 }}>版本更新提示</h3>
        <p style={{ color: '#666', marginBottom: 16 }}>{message}</p>
        {cloudVersion && (
          <p style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>
            云端版本: v{cloudVersion}
          </p>
        )}
        {supportContact && (
          <p style={{ color: '#666', fontSize: 13 }}>
            支持联系: {supportContact}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default VersionUpdateModal;
```

---

## Task 4: 创建主页面

**Files:**
- Create: `src/pages/System/DataSync/index.tsx`

```typescript
/**
 * 数据同步页面
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Space, Table, Modal, message, Alert } from 'antd';
import { CloudUploadOutlined, CloudDownloadOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import BackupProgress from './components/BackupProgress';
import VersionUpdateModal from './components/VersionUpdateModal';
import { apiClient } from '@/utils/api';
import type { WebdavBackupFile, WebdavProgressResponse, VersionCompareResponse } from '@/types/api.schemas';
import styles from './index.module.scss';

const DataSyncPage: React.FC = () => {
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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadBackupList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ success: boolean; data: WebdavBackupFile[] }>('/api/v1/webdav/list');
      setBackupList(response.data || []);
    } catch (err) {
      message.error('获取备份列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const response = await apiClient.get<VersionCompareResponse>('/api/v1/version/compare');
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
        const response = await apiClient.get<WebdavProgressResponse>(
          `/api/v1/webdav/progress/${taskId}`
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
      const response = await apiClient.post<{ success: boolean; task_id: string; error?: string }>(
        '/api/v1/webdav/backup',
        { description: '' }
      );

      if (response.success) {
        taskIdRef.current = response.task_id;
        setProgress({ status: 'pending', progress: 0, message: '' });
        setProgressVisible(true);
        startPolling(response.task_id);
      } else {
        message.error('启动备份失败: ' + (response.error || '未知错误'));
      }
    } catch (err) {
      message.error('备份失败');
    }
  };

  const handleRestore = async (filename: string) => {
    Modal.confirm({
      title: '确认恢复',
      content: `确定要恢复备份 "${filename}" 吗？恢复前会自动备份当前数据库。`,
      onOk: async () => {
        try {
          const response = await apiClient.post<{ success: boolean; task_id: string; error?: string }>(
            '/api/v1/webdav/restore',
            { filename }
          );

          if (response.success) {
            taskIdRef.current = response.task_id;
            setProgress({ status: 'pending', progress: 0, message: '' });
            setProgressVisible(true);
            startPolling(response.task_id);
          } else {
            message.error('启动恢复失败: ' + (response.error || '未知错误'));
          }
        } catch (err) {
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
          const response = await apiClient.post<{ success: boolean; message?: string }>(
            '/api/v1/webdav/delete',
            { filename }
          );

          if (response.success) {
            message.success('删除成功');
            loadBackupList();
          } else {
            message.error('删除失败: ' + (response.message || '未知错误'));
          }
        } catch (err) {
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
              <span style={{ color: '#52c41a', fontSize: 12, marginLeft: 8 }}>(压缩)</span>
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
    <div className={styles.dataSyncPage}>
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
            icon={<CloudDownloadOutlined />}
            onClick={() => {
              if (backupList.length === 0) {
                message.warning('没有可用的备份文件');
                return;
              }
              // 显示恢复对话框
              Modal.confirm({
                title: '选择备份文件',
                content: (
                  <div>
                    {backupList.map((b, i) => (
                      <div key={b.filename} style={{ marginBottom: 8 }}>
                        {i + 1}. {b.filename} ({formatFileSize(b.size)}) - {b.created}
                      </div>
                    ))}
                  </div>
                ),
                // 这里简化处理，实际可以用更复杂的选择UI
              });
            }}
            disabled={progressVisible}
          >
            从坚果云恢复数据库
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadBackupList}
            disabled={progressVisible}
          >
            刷新备份列表
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
          message="使用说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><strong>备份数据库到坚果云</strong>：将整个数据库文件上传到坚果云网盘</li>
              <li><strong>从坚果云恢复数据库</strong>：从坚果云下载备份文件并恢复（恢复前会自动备份当前数据库）</li>
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

export default DataSyncPage;
```

---

## Task 5: 创建样式文件

**Files:**
- Create: `src/pages/System/DataSync/index.module.scss`

```scss
.dataSyncPage {
  .header {
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }
}
```

---

## Task 6: 注册路由

**Files:**
- Modify: `src/router/index.tsx`

```typescript
import DataSyncPage from '@/pages/System/DataSync';

{
  path: '/system/data-sync',
  element: <DataSyncPage />,
}
```

---

## 验收标准

- [ ] 备份功能正常
- [ ] 恢复功能正常
- [ ] 进度显示正确
- [ ] 备份列表加载正常
- [ ] 删除备份功能正常
- [ ] 版本更新提示正常
- [ ] 无TypeScript编译错误

---

## API参数检查清单

| API端点 | 参数 | 状态 |
|--------|------|------|
| POST /api/v1/webdav/backup | description? | ✅ |
| POST /api/v1/webdav/restore | filename | ✅ |
| GET /api/v1/webdav/list | 无 | ✅ |
| POST /api/v1/webdav/delete | filename | ✅ |
| GET /api/v1/webdav/progress/{task_id} | 无 | ✅ |
| GET /api/v1/version/compare | 无 | ✅ |

---

**最后更新**: 2026-03-13