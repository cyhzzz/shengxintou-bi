/**
 * 数据同步页面
 * 实现坚果云数据库备份/恢复功能
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Space, Table, Modal, message, Alert, Spin, Tag, Form, Input, InputNumber, Switch } from 'antd';
import { CloudUploadOutlined, ReloadOutlined, DeleteOutlined, CloudDownloadOutlined, WifiOutlined, SyncOutlined, SettingOutlined, ApiOutlined } from '@ant-design/icons';
import BackupProgress from './components/BackupProgress';
import VersionUpdateModal from './components/VersionUpdateModal';
import { http } from '@/services/http';
import { dataServiceWebdav, dataServiceSync, type WebdavSyncStatus, type SyncStatus, type SyncResult, type WebdavConfig } from '@/services/dataService';
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

  // 同步状态（云端 vs 本地最新日期）
  const [syncStatus, setSyncStatus] = useState<WebdavSyncStatus | null>(null);
  const [syncChecking, setSyncChecking] = useState(false);
  const [syncConfirmVisible, setSyncConfirmVisible] = useState(false);

  // v3.4.3: 双向同步（SQLite ↔ Supabase PG）
  const [dbSyncStatus, setDbSyncStatus] = useState<SyncStatus | null>(null);
  const [dbSyncLoading, setDbSyncLoading] = useState(false);
  const [dbSyncOperating, setDbSyncOperating] = useState<null | 'upload' | 'download'>(null);
  const [dbSyncResult, setDbSyncResult] = useState<SyncResult | null>(null);
  const [dbSyncConfirm, setDbSyncConfirm] = useState<{ visible: boolean; direction: 'upload' | 'download' }>({ visible: false, direction: 'upload' });

  // v3.5.8: WebDAV 配置可视化编辑
  const [webdavConfig, setWebdavConfig] = useState<WebdavConfig | null>(null);
  const [webdavConfigLoading, setWebdavConfigLoading] = useState(false);
  const [webdavConfigSaving, setWebdavConfigSaving] = useState(false);
  const [webdavTesting, setWebdavTesting] = useState(false);
  const [configFormVisible, setConfigFormVisible] = useState(false);
  const [configForm] = Form.useForm();

  const taskIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBackupList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await http.get<WebdavBackupFile[]>('/webdav/list');
      if (response.success) {
        setBackupList(response.data || []);
      } else {
        // 透出后端 error code，便于定位是 LIST_FAILED / 配置 / 凭据问题
        const errCode = (response as any)?.error || 'UNKNOWN';
        message.error(`获取备份列表失败（${errCode}）：${response.message || '未知原因'}，请使用「测试连接」按钮自检`);
      }
    } catch (err: any) {
      // 网络层异常：Vite proxy / Flask 500 / 离线 / 跨域
      const status = err?.response?.status || err?.status || '网络层错误';
      message.error(`获取备份列表失败（${status}）：请检查后端 Flask 是否启动或使用「测试连接」自检`);
    } finally {
      setLoading(false);
    }
  }, []);

  // 检测云端 vs 本地数据日期差
  const loadSyncStatus = useCallback(async () => {
    setSyncChecking(true);
    try {
      const res = await dataServiceWebdav.checkSyncStatus();
      if (res?.success) {
        setSyncStatus(res.data);
      }
    } catch {
      // 静默：连接失败不弹错
    } finally {
      setSyncChecking(false);
    }
  }, []);

  // 加载双向同步状态（本地 SQLite vs 云端 PG）
  const loadDbSyncStatus = useCallback(async () => {
    setDbSyncLoading(true);
    try {
      const res = await dataServiceSync.getStatus();
      if (res?.success) {
        setDbSyncStatus(res.data);
        // 状态刷新后清空上次结果（避免显示与当前状态不一致的旧结果）
        setDbSyncResult(null);
      }
    } catch (err) {
      // 静默：云端不可达时不弹错
      console.error('加载双向同步状态失败:', err);
    } finally {
      setDbSyncLoading(false);
    }
  }, []);

  // 执行双向同步（上传 / 下载）
  const runDbSync = useCallback(async (direction: 'upload' | 'download') => {
    setDbSyncConfirm({ visible: false, direction });
    setDbSyncOperating(direction);
    setDbSyncResult(null);
    try {
      const res = direction === 'upload'
        ? await dataServiceSync.upload()
        : await dataServiceSync.download();
      if (res?.success) {
        setDbSyncResult(res.data);
        const dirLabel = direction === 'upload' ? '上传到云端' : '从云端下载';
        const totalRows = res.data.total_rows;
        const hasError = Object.values(res.data.results || {}).some((r: any) => r.error);
        const skippedCount = Object.values(res.data.results || {}).filter((r: any) => r.skipped).length;
        const tip = hasError
          ? `${dirLabel}完成，共同步 ${totalRows.toLocaleString()} 行（部分表失败，请查看下方详情）`
          : `${dirLabel}完成，共同步 ${totalRows.toLocaleString()} 行${skippedCount ? `（跳过 ${skippedCount} 张本地维护表）` : ''}`;
        // v3.4.3: 用 message 弹一个保持 6 秒的醒目提示（默认 3s 容易错过）
        message.open({
          type: hasError ? 'warning' : 'success',
          content: tip,
          duration: 6,
        });
        // 同步完成后刷新状态
        loadDbSyncStatus();
      } else {
        message.error(res?.message || '同步失败');
      }
    } catch (err: any) {
      const status = err?.response?.status || err?.status || '网络层错误';
      message.error(`同步失败（${status}）`);
    } finally {
      setDbSyncOperating(null);
    }
  }, [loadDbSyncStatus]);

  const checkVersion = useCallback(async () => {
    try {
      const response = await http.get<VersionCompareResponse>('/version/compare');
      if (response.success && response.data?.has_update) {
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

  // v3.5.8: 加载 WebDAV 配置
  const loadWebdavConfig = useCallback(async () => {
    setWebdavConfigLoading(true);
    try {
      const res = await dataServiceWebdav.getConfig();
      if (res?.success && res.data) {
        setWebdavConfig(res.data);
      }
    } catch (err) {
      // 静默失败：后端未配置时不应弹错
      console.error('加载 WebDAV 配置失败:', err);
    } finally {
      setWebdavConfigLoading(false);
    }
  }, []);

  // 保存 WebDAV 配置
  const handleSaveWebdavConfig = useCallback(async (values: any) => {
    setWebdavConfigSaving(true);
    try {
      // 密码字段：若仍是掩码（••••••），不传给后端，保留原值
      const payload: Partial<WebdavConfig> = {
        url: values.url,
        username: values.username,
        backup_dir: values.backup_dir,
        max_backups: values.max_backups,
        use_compression: values.use_compression,
        verify_ssl: values.verify_ssl,
      };
      // 密码：仅在用户输入了新值（非掩码）时传
      if (values.password && !values.password.startsWith('••')) {
        payload.password = values.password;
      }
      const res = await dataServiceWebdav.saveConfig(payload);
      if (res?.success) {
        message.success('配置已保存到 .env');
        if (res.data) {
          setWebdavConfig(res.data);
        }
        setConfigFormVisible(false);
        // 保存后刷新备份列表和同步状态（新配置可能改变连接）
        loadBackupList();
        loadSyncStatus();
      } else {
        message.error(res?.message || '保存失败');
      }
    } catch (err: any) {
      message.error('保存配置失败: ' + (err?.message || '未知错误'));
    } finally {
      setWebdavConfigSaving(false);
    }
  }, [loadBackupList, loadSyncStatus]);

  // 测试连接（用当前已保存的配置）
  const handleTestWebdav = useCallback(async () => {
    setWebdavTesting(true);
    try {
      const res = await dataServiceWebdav.testConnection();
      if (res?.success && res.data?.success) {
        message.success(`连接正常（HTTP ${res.data.status_code ?? ''}）`);
      } else {
        message.error('连接异常：' + (res?.data?.message || res?.message || '未知错误'));
      }
    } catch (err: any) {
      message.error('连接测试失败: ' + (err?.message || '未知错误'));
    } finally {
      setWebdavTesting(false);
    }
  }, []);

  // 打开配置表单：把当前配置回填到表单
  const openConfigForm = useCallback(() => {
    if (webdavConfig) {
      configForm.setFieldsValue({
        url: webdavConfig.url,
        username: webdavConfig.username,
        password: webdavConfig.password,  // 掩码（••••••1234）
        backup_dir: webdavConfig.backup_dir,
        max_backups: webdavConfig.max_backups,
        use_compression: webdavConfig.use_compression,
        verify_ssl: webdavConfig.verify_ssl,
      });
    }
    setConfigFormVisible(true);
  }, [webdavConfig, configForm]);

  useEffect(() => {
    loadBackupList();
    checkVersion();
    loadSyncStatus();
    loadDbSyncStatus();
    loadWebdavConfig();
  }, [loadBackupList, checkVersion, loadSyncStatus, loadDbSyncStatus, loadWebdavConfig]);

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
        const response = await http.get<WebdavProgressResponse>(
          `/webdav/progress/${taskId}`
        );
        if (response.success && response.data) {
          const data = response.data;
          setProgress({
            status: data.status,
            progress: data.progress,
            message: data.message || '',
          });

          if (data.status === 'completed' || data.status === 'failed') {
            stopPolling();
            setTimeout(() => {
              setProgressVisible(false);
              if (data.status === 'completed') {
                message.success('操作完成');
                // 同步/恢复完成后重新检测云端 vs 本地
                loadSyncStatus();
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

  const handleAutoSync = async () => {
    setSyncConfirmVisible(false);
    try {
      const response = await http.post<{ task_id: string }>('/webdav/auto-sync', {});
      if (response.success && response.data?.task_id) {
        taskIdRef.current = response.data.task_id;
        setProgress({ status: 'pending', progress: 0, message: '' });
        setProgressVisible(true);
        startPolling(response.data.task_id);
      } else {
        message.error('启动同步失败: ' + (response.message || '未知错误'));
        // v3.4.1: 后端校验门拒绝(META_MISSING / NO_SYNC_NEEDED)后自动刷新一次状态
        loadSyncStatus();
      }
    } catch {
      message.error('同步失败');
    }
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
              <span className={`${styles.sizeTag}`} style={{ color: "var(--color-success)", fontSize: "var(--text-sm)" }}>
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
          <Space size="small">
            <Tag color={webdavConfig?.password_configured ? 'green' : 'orange'}>
              {webdavConfig?.password_configured ? '已配置' : '未配置'}
            </Tag>
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={openConfigForm}
              loading={webdavConfigLoading}
            >
              WebDAV 配置
            </Button>
            <Button
              size="small"
              icon={<ApiOutlined />}
              onClick={handleTestWebdav}
              loading={webdavTesting}
              disabled={!webdavConfig?.password_configured}
            >
              测试连接
            </Button>
          </Space>
        </div>

        {/* 操作按钮 */}
        <Space size="middle" wrap className={styles.actionsBar}>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={handleBackup}
            disabled={progressVisible || !webdavConfig?.password_configured}
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
        </Space>

        {/* 进度显示 */}
        {progressVisible && (
          <BackupProgress
            status={progress.status}
            progress={progress.progress}
            message={progress.message}
          />
        )}

        {/* 未配置提示 */}
        {!webdavConfig?.password_configured && !webdavConfigLoading && (
          <Alert
            type="info"
            showIcon
            message="尚未配置 WebDAV 凭据"
            description="点击右上角「WebDAV 配置」按钮，填入坚果云服务器地址、账号和应用密码即可启用云备份功能。配置保存在本地 .env 文件，不会随安装包分发。"
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 云端 vs 本地同步状态卡片 */}
        {syncStatus && (
          <Alert
            className={styles.syncAlert}
            style={{ marginBottom: 16 }}
            type={
              !syncStatus.cloud_available ? 'info'
              : syncStatus.need_sync ? 'warning'
              : 'success'
            }
            showIcon
            icon={!syncStatus.cloud_available ? <WifiOutlined /> : <CloudDownloadOutlined />}
            message={
              <Space size="small" wrap>
                <span>
                  {!syncStatus.cloud_available
                    ? '坚果云未连接（同步检测不可用，请检查网络或配置）'
                    : syncStatus.need_sync
                      ? syncStatus.needs_meta_rebuild
                        ? `云端备份新于本地但缺 meta，请先做一次本地备份补齐 meta（差异 ${syncStatus.diff_hours} 小时）`
                        : `检测到云端数据新于本地（差异 ${syncStatus.diff_hours} 小时）`
                      : '云端与本地数据日期一致，无需同步'}
                </span>
                <Spin spinning={syncChecking} size="small" />
                {syncStatus.cloud_available && (
                  <Space size={4}>
                    <Tag>本地 {syncStatus.local_latest || '无'}</Tag>
                    <Tag color="cyan">云端数据 {syncStatus.cloud_data_latest || syncStatus.cloud_latest || '无'}</Tag>
                    {syncStatus.meta_source === 'file_mtime' && (
                      <Tag color="orange">云端备份缺 meta(下次本地备份后自动补齐)</Tag>
                    )}
                  </Space>
                )}
              </Space>
            }
            description={
              syncStatus.cloud_available ? (
                <Space size="small" wrap style={{ marginTop: 4 }}>
                  {syncStatus.need_sync ? (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CloudDownloadOutlined />}
                      onClick={() => setSyncConfirmVisible(true)}
                      disabled={progressVisible || syncStatus.needs_meta_rebuild}
                    >
                      {syncStatus.needs_meta_rebuild ? '需先补 meta 才能同步' : '立即从坚果云同步最新备份'}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={loadSyncStatus}
                    disabled={syncChecking || progressVisible}
                  >
                    重新检测
                  </Button>
                </Space>
              ) : null
            }
          />
        )}

        {/* 备份列表 */}
        <div className={styles.backupHistoryBlock}><h4 className={styles.backupHistoryTitle}>备份历史</h4>
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
        <Alert className={styles.usageAlert}
          type="info"
          title="使用说明"
          description={
            <ul className={styles.usageList}>
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

      {/* 双向同步卡片（SQLite ↔ Supabase PG） */}
      <Card className={styles.dbSyncCard}>
        <div className={styles.header}>
          <h3>数据库双向同步</h3>
          <Space size="small">
            <Tag color={dbSyncStatus?.local ? (dbSyncStatus.local.dialect === 'postgresql' ? 'purple' : 'blue') : 'default'}>
              本地 {dbSyncStatus?.local?.dialect?.toUpperCase() || '-'}
            </Tag>
            <Tag color="cyan">
              云端 {dbSyncStatus?.cloud?.dialect?.toUpperCase() || '-'}
            </Tag>
          </Space>
        </div>

        {!dbSyncStatus?.available ? (
          <Alert
            type="info"
            showIcon
            icon={<WifiOutlined />}
            message={dbSyncStatus?.message || '未配置 CLOUD_DATABASE_URL，双向同步功能不可用'}
            description={<span className={styles.syncHint}>此功能用于本地 SQLite 与云端 Supabase PG 之间的数据互相同步。请在后端 .env 中配置 CLOUD_DATABASE_URL 后启用。</span>}
          />
        ) : (
          <>
            <Space size="middle" wrap className={styles.actionsBar}>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                loading={dbSyncOperating === 'upload'}
                disabled={dbSyncOperating !== null}
                onClick={() => setDbSyncConfirm({ visible: true, direction: 'upload' })}
              >
                上传到云端（本地 → PG）
              </Button>
              <Button
                icon={<CloudDownloadOutlined />}
                loading={dbSyncOperating === 'download'}
                disabled={dbSyncOperating !== null}
                onClick={() => setDbSyncConfirm({ visible: true, direction: 'download' })}
              >
                从云端下载（PG → 本地）
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadDbSyncStatus}
                disabled={dbSyncLoading || dbSyncOperating !== null}
              >
                重新检测
              </Button>
              <Spin spinning={dbSyncLoading} size="small" />
            </Space>

            {/* 数据对比表 */}
            {dbSyncStatus.local && dbSyncStatus.cloud && (
              <div className={styles.dbSyncTableWrap}>
                <div className={styles.dbSyncMeta}>
                  <span>本地最新数据日期：<strong>{dbSyncStatus.local.latest_date || '无'}</strong></span>
                  <span>云端最新数据日期：<strong>{dbSyncStatus.cloud.latest_date || '无'}</strong></span>
                </div>
                <Table
                  size="small"
                  rowKey="table"
                  pagination={false}
                  dataSource={Object.keys(dbSyncStatus.local.counts).map((t) => ({
                    table: t,
                    local: dbSyncStatus.local!.counts[t],
                    cloud: dbSyncStatus.cloud!.counts[t],
                  }))}
                  columns={[
                    { title: '业务表', dataIndex: 'table', key: 'table' },
                    {
                      title: '本地行数',
                      dataIndex: 'local',
                      key: 'local',
                      render: (v: number) => v < 0 ? <Tag color="red">表缺失</Tag> : v.toLocaleString(),
                    },
                    {
                      title: '云端行数',
                      dataIndex: 'cloud',
                      key: 'cloud',
                      render: (v: number) => v < 0 ? <Tag color="red">表缺失</Tag> : v.toLocaleString(),
                    },
                    {
                      title: '差异',
                      key: 'diff',
                      render: (_: unknown, r: { local: number; cloud: number }) => {
                        if (r.local < 0 || r.cloud < 0) return <Tag color="red">异常</Tag>;
                        const d = r.cloud - r.local;
                        if (d === 0) return <Tag color="green">一致</Tag>;
                        return <Tag color={d > 0 ? 'orange' : 'blue'}>{d > 0 ? `+${d}` : d}</Tag>;
                      },
                    },
                  ]}
                />
              </div>
            )}

            {/* 同步结果 */}
            {dbSyncResult && (
              <Alert
                className={styles.dbSyncResult}
                type={Object.values(dbSyncResult.results).some(r => r.error) ? 'warning' : 'success'}
                showIcon
                icon={<SyncOutlined />}
                message={`${dbSyncResult.direction === 'upload' ? '上传到云端' : '从云端下载'}完成，共同步 ${dbSyncResult.total_rows.toLocaleString()} 行`}
                description={
                  <ul className={styles.usageList}>
                    {Object.entries(dbSyncResult.results).map(([t, r]) => (
                      <li key={t}>
                        <strong>{t}</strong>：
                        {r.skipped ? '已跳过' : r.error ? <span style={{ color: 'var(--color-danger)' }}>失败 — {r.error}</span> : `${(r.rows ?? 0).toLocaleString()} 行`}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
          </>
        )}
      </Card>

      {/* 版本更新弹窗 */}
      <VersionUpdateModal
        visible={versionModalVisible}
        message={versionInfo?.message || ''}
        cloudVersion={versionInfo?.cloudVersion}
        supportContact={versionInfo?.supportContact}
        onClose={() => setVersionModalVisible(false)}
      />

      {/* v3.4.1: 一键同步确认弹窗 */}
      <Modal
        title="确认从坚果云同步"
        open={syncConfirmVisible}
        onOk={handleAutoSync}
        onCancel={() => setSyncConfirmVisible(false)}
        okText="确认同步"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>将从坚果云下载最新备份并恢复本地数据库：</p>
        <ul>
          <li>云端数据日期：<strong>{syncStatus?.cloud_data_latest || syncStatus?.cloud_latest || '-'}</strong></li>
          <li>云端备份时间：<strong>{syncStatus?.cloud_latest || '-'}</strong></li>
          <li>备份文件：<strong>{syncStatus?.cloud_filename || '-'}</strong></li>
          <li>本地最新日期：<strong>{syncStatus?.local_latest || '无'}</strong></li>
        </ul>
        <p style={{ color: 'var(--color-warning)' }}>
          ⚠️ 同步前会自动备份当前数据库；同步期间所有报表查询不可用，请避开业务高峰期操作。
        </p>
      </Modal>

      {/* 双向同步确认弹窗 */}
      <Modal
        title={dbSyncConfirm.direction === 'upload' ? '确认上传到云端' : '确认从云端下载'}
        open={dbSyncConfirm.visible}
        onOk={() => runDbSync(dbSyncConfirm.direction)}
        onCancel={() => setDbSyncConfirm({ visible: false, direction: dbSyncConfirm.direction })}
        okText={dbSyncConfirm.direction === 'upload' ? '确认上传' : '确认下载'}
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={dbSyncOperating !== null}
      >
        <p>
          {dbSyncConfirm.direction === 'upload'
            ? '将本地数据库的全部业务表覆盖写入到云端 Supabase PG：'
            : '将云端 Supabase PG 的全部业务表覆盖写入到本地数据库：'}
        </p>
        <ul>
          <li>本地最新数据日期：<strong>{dbSyncStatus?.local?.latest_date || '无'}</strong></li>
          <li>云端最新数据日期：<strong>{dbSyncStatus?.cloud?.latest_date || '无'}</strong></li>
        </ul>
        <p style={{ color: 'var(--color-warning)' }}>
          ⚠️ 此操作会先删除目标库同名表全部数据再写入，<strong>不可撤销</strong>。请确认方向后再继续。
        </p>
      </Modal>

      {/* v3.5.8: WebDAV 配置编辑弹窗 */}
      <Modal
        title="WebDAV 配置"
        open={configFormVisible}
        onCancel={() => setConfigFormVisible(false)}
        onOk={() => configForm.submit()}
        confirmLoading={webdavConfigSaving}
        width={560}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="配置保存到本地 .env 文件"
          description={
            <div>
              <div>· 坚果云用户请使用「应用密码」，非账号登录密码</div>
              <div>· 应用密码在坚果云网页「安全选项」中生成</div>
              <div>· 配置文件路径：{webdavConfig?.env_path || '%APPDATA%\\省心投 BI\\.env'}</div>
              <div>· 密码留空或保持掩码（••••••）表示不修改原值</div>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
        <Form form={configForm} layout="vertical" onFinish={handleSaveWebdavConfig}>
          <Form.Item
            name="url"
            label="WebDAV 服务器地址"
            rules={[{ required: true, message: '请输入服务器地址' }]}
            tooltip="坚果云：https://dav.jianguoyun.com/dav/"
          >
            <Input placeholder="https://dav.jianguoyun.com/dav/" />
          </Form.Item>
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
            tooltip="坚果云账号邮箱（如 yourname@example.com）"
          >
            <Input placeholder="yourname@example.com" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label="应用密码"
            tooltip="坚果云「安全选项」生成的应用密码，非登录密码"
          >
            <Input.Password
              placeholder="留空表示保留原密码"
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            name="backup_dir"
            label="备份目录"
            tooltip="WebDAV 服务器上的备份目录路径"
          >
            <Input placeholder="/shengxintou-backup/" />
          </Form.Item>
          <Form.Item
            name="max_backups"
            label="最大备份保留数"
            tooltip="超过此数量后自动清理最旧的备份"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="use_compression"
            label="启用压缩（.db.gz）"
            valuePropName="checked"
            tooltip="压缩备份文件以节省空间"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="verify_ssl"
            label="验证 SSL 证书"
            valuePropName="checked"
            tooltip="生产环境建议开启，自签名证书可临时关闭"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DatabaseBackupPage;