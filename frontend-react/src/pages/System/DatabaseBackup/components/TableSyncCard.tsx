/**
 * 逐表同步卡片（v3.9.3）
 *
 * 无身份、全等权限模型下的 WebDAV 逐表同步：
 * - 列出业务表清单，对比"本地 vs 云端"的版本与行数
 * - 版本「新者胜、等者不动」：上传时本地严格新于云端才覆盖；下载时云端严格新于本地才覆盖
 * - 不显示任何角色/负责人字段
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Alert, Spin, Modal, message } from 'antd';
import { CloudUploadOutlined, CloudDownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  dataServiceTableSync,
  SYNC_TABLE_META,
  type TableSyncManifestData,
  type TableSyncResultRow,
} from '@/services/dataService';

type RowStatus = 'local_new' | 'cloud_new' | 'equal' | 'no_local' | 'no_cloud' | 'cloud_missing';

interface TableRow {
  name: string;
  label: string;
  type: 'dim' | 'fact';
  localVersion: string | null;
  localRows: number | null;
  cloudVersion: string | null;
  cloudRows: number | null;
  status: RowStatus;
}

/** 把版本归一化成可比较的数字：'2026-08-23' -> 20260823；'20260824_083000' -> 20260824083000 */
function versionNum(v?: string | null): number | null {
  if (!v) return null;
  const digits = v.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return parseInt(digits, 10);
}

export default function TableSyncCard() {
  const [manifest, setManifest] = useState<TableSyncManifestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [operating, setOperating] = useState<null | { direction: 'upload' | 'download'; tables: string[] }>(null);
  const [result, setResult] = useState<Record<string, TableSyncResultRow> | null>(null);
  const [lastResultDir, setLastResultDir] = useState<null | 'upload' | 'download'>(null);
  const [batchConfirm, setBatchConfirm] = useState<null | 'upload' | 'download'>(null);

  const loadManifest = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await dataServiceTableSync.getManifest();
      if (res.success && res.data) {
        setManifest(res.data);
      } else {
        const errCode = (res as any)?.error || 'UNKNOWN';
        message.error(`获取逐表清单失败（${errCode}）：${res.message || '未知原因'}`);
      }
    } catch (err: any) {
      const status = err?.response?.status || err?.status || '网络层错误';
      message.error(`获取逐表清单失败（${status}）：请检查后端服务`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  const rows: TableRow[] = SYNC_TABLE_META.map((m) => {
    const local = manifest?.local?.[m.name];
    const cloud = manifest?.cloud?.[m.name];
    const lv = local?.version ?? null;
    const cv = cloud?.version ?? null;
    const ln = versionNum(lv);
    const cn = versionNum(cv);
    let status: RowStatus = 'no_local';
    if (!lv) status = 'no_local';
    else if (!cv) status = 'no_cloud';
    else if (ln !== null && cn !== null) {
      if (ln > cn) status = 'local_new';
      else if (ln < cn) status = 'cloud_new';
      else status = 'equal';
    } else {
      status = 'equal';
    }
    return {
      name: m.name,
      label: m.label,
      type: m.type,
      localVersion: lv,
      localRows: local?.rows ?? null,
      cloudVersion: cv,
      cloudRows: cloud?.rows ?? null,
      status,
    };
  });

  const notConfigured = manifest?.not_configured !== false;
  const cloudInitialized = rows.some((r) => r.cloudRows !== null);

  const statusTag = (s: RowStatus) => {
    switch (s) {
      case 'local_new': return <Tag color="blue">本地新</Tag>;
      case 'cloud_new': return <Tag color="cyan">云端新</Tag>;
      case 'equal': return <Tag color="green">一致</Tag>;
      case 'no_local': return <Tag color="default">无本地数据</Tag>;
      case 'no_cloud': return <Tag color="orange">云端无数据</Tag>;
      default: return <Tag>未知</Tag>;
    }
  };

  const runOperation = async (direction: 'upload' | 'download', tables: string[]) => {
    if (!tables.length) return;
    setOperating({ direction, tables });
    setResult(null);
    try {
      const res = direction === 'upload'
        ? await dataServiceTableSync.upload(tables)
        : await dataServiceTableSync.download(tables);
      if (res.success && res.data?.results) {
        setResult(res.data.results);
        setLastResultDir(direction);
        // 排除后端返回的整库快照同步结果（非业务表，仅表示老客户端整库兜底已顺便更新）
        const tableResults = Object.entries(res.data.results).filter(([k]) => k !== '__whole_snapshot__');
        const uploaded = tableResults.filter(([, r]) => r.status === 'uploaded' || r.status === 'downloaded').length;
        const skipped = tableResults.filter(([, r]) => r.status === 'skipped').length;
        const failed = tableResults.filter(([, r]) => r.status === 'error').length;
        const dirLabel = direction === 'upload' ? '上传' : '下载';
        if (failed) {
          message.warning(`${dirLabel}完成：上传 ${uploaded} 张、跳过 ${skipped} 张、失败 ${failed} 张`);
        } else {
          message.success(`${dirLabel}完成：${uploaded} 张${uploaded ? '' : '（云端已是最新，无需覆盖）'}，跳过 ${skipped} 张`);
        }
        loadManifest();
      } else {
        message.error(res.message || `${direction === 'upload' ? '上传' : '下载'}失败`);
      }
    } catch (err: any) {
      message.error(`${direction === 'upload' ? '上传' : '下载'}失败：${err?.message || '网络错误'}`);
    } finally {
      setOperating(null);
      setSelectedKeys([]);
    }
  };

  const confirmBatch = (direction: 'upload' | 'download') => {
    if (!selectedKeys.length) {
      message.info('请先勾选需要同步的业务表');
      return;
    }
    setBatchConfirm(direction);
  };

  const columns = [
    {
      title: '业务表',
      dataIndex: 'label',
      key: 'label',
      render: (label: string, r: TableRow) => (
        <span>
          {label}
          <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            {r.name}
          </span>
          {r.type === 'dim' ? <Tag style={{ marginLeft: 8 }}>维表</Tag> : null}
        </span>
      ),
    },
    {
      title: '本地行数',
      dataIndex: 'localRows',
      key: 'localRows',
      width: 110,
      render: (v: number | null) => (v === null ? '—' : v.toLocaleString()),
    },
    {
      title: '云端行数',
      dataIndex: 'cloudRows',
      key: 'cloudRows',
      width: 110,
      render: (v: number | null) => (v === null ? '—' : v.toLocaleString()),
    },
    {
      title: '本地版本',
      dataIndex: 'localVersion',
      key: 'localVersion',
      width: 130,
      render: (v: string | null) => v || '—',
    },
    {
      title: '云端版本',
      dataIndex: 'cloudVersion',
      key: 'cloudVersion',
      width: 130,
      render: (v: string | null) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: RowStatus) => statusTag(s),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, r: TableRow) => (
        <Space size="small">
          <Button
            size="small"
            icon={<CloudUploadOutlined />}
            loading={operating?.direction === 'upload' && operating.tables.includes(r.name)}
            disabled={!!operating || notConfigured}
            onClick={() => runOperation('upload', [r.name])}
          >
            上传
          </Button>
          <Button
            size="small"
            icon={<CloudDownloadOutlined />}
            loading={operating?.direction === 'download' && operating.tables.includes(r.name)}
            disabled={!!operating || notConfigured}
            onClick={() => runOperation('download', [r.name])}
          >
            下载
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title={(
      <Space size="small">
        <span>逐表同步</span>
        <Tag color="orange">v3.9.3</Tag>
      </Space>
    )}
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined spin={loading} />}
          onClick={loadManifest}
          disabled={!!operating}
        >
          刷新
        </Button>
      }
    >
      {notConfigured ? (
        <Alert
          type="info"
          showIcon
          message="尚未配置 WebDAV 凭据"
          description="请先在上方「WebDAV 配置」中填入坚果云服务器地址、账号和应用密码，即可对本机各业务表进行逐表上传/下载。"
        />
      ) : (
        <>
          <Alert
            type={cloudInitialized ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
            message={cloudInitialized ? '版本「新者胜、等者不动」' : '云端尚未初始化逐表文件'}
            description={
              cloudInitialized
                ? '不同同事可各自对自己负责的表增量上传，云端各表保持独立最新；本地或云端版本相同时不会被覆盖，防止等权限下旧数据误覆盖新数据。'
                : '点击任意「上传」按钮将把对应业务表首次上传到云端；建议先在桌面端逐个确认后上传初始化。'
            }
          />

          {/* 批量操作 */}
          <Space size="middle" wrap style={{ marginBottom: 16 }}>
            <Button
              icon={<CloudUploadOutlined />}
              type="primary"
              onClick={() => confirmBatch('upload')}
              disabled={!!operating || notConfigured}
            >
              上传勾选（{selectedKeys.length}）
            </Button>
            <Button
              icon={<CloudDownloadOutlined />}
              onClick={() => confirmBatch('download')}
              disabled={!!operating || notConfigured}
            >
              下载勾选（{selectedKeys.length}）
            </Button>
            {operating && <Spin size="small" />}
          </Space>

          <Table
            size="small"
            rowKey="name"
            loading={loading}
            dataSource={rows}
            columns={columns}
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys as string[]),
              getCheckboxProps: () => ({ disabled: !!operating }),
            }}
          />

          {result && (
            <Alert
              style={{ marginTop: 16 }}
              type={Object.values(result).some((r) => r.status === 'error') ? 'warning' : 'success'}
              showIcon
              message={`${lastResultDir === 'upload' ? '上传' : '下载'}结果`}
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {Object.entries(result).map(([t, r]) => {
                    if (t === '__whole_snapshot__') {
                      return (
                        <li key={t}>
                          <strong>整库快照（老客户端兼容）</strong>：
                          {r.status === 'error'
                            ? <span style={{ color: 'var(--color-danger)' }}>失败 — {r.message}</span>
                            : r.status === 'started'
                              ? <span>后台同步中…</span>
                              : r.filename
                                ? <span style={{ color: 'var(--color-success)' }}>已同步 — {r.filename}</span>
                                : <span>已同步</span>}
                        </li>
                      );
                    }
                    const meta = SYNC_TABLE_META.find((m) => m.name === t);
                    const reasonText =
                      r.status === 'skipped'
                        ? r.reason === 'cloud_newer' ? '云端已更新，本地旧，未覆盖' :
                          r.reason === 'no_local_version' ? '本地无数据' :
                          r.reason === 'cloud_missing' ? '云端无该表' :
                          '已是最新，跳过'
                        : '';
                    return (
                      <li key={t}>
                        <strong>{meta?.label || t}</strong>：
                        {r.status === 'error'
                          ? <span style={{ color: 'var(--color-danger)' }}>失败 — {r.message}</span>
                          : r.status === 'skipped'
                            ? `${r.reason === 'no_local_version' || r.reason === 'cloud_missing' ? '跳过' : '保留云端'} — ${reasonText}`
                            : `${(r.rows ?? 0).toLocaleString()} 行${r.from === 'snapshot' ? '（来自老版本整库快照兜底）' : ''}`}
                      </li>
                    );
                  })}
                </ul>
              }
            />
          )}
        </>
      )}

      {/* 批量操作确认 */}
      <Modal
        title={batchConfirm === 'upload' ? '确认上传勾选表' : '确认下载勾选表'}
        open={!!batchConfirm}
        onOk={() => {
          if (batchConfirm) runOperation(batchConfirm, selectedKeys);
          setBatchConfirm(null);
        }}
        onCancel={() => setBatchConfirm(null)}
        okText={batchConfirm === 'upload' ? '确认上传' : '确认下载'}
        cancelText="取消"
        confirmLoading={!!operating}
        okButtonProps={{ danger: true }}
      >
        <p>
          {batchConfirm === 'upload'
            ? '将下列表的本地版本上传到云端（仅当本地严格新于云端才覆盖，否则保留云端）：'
            : '从云端拉取下列表合并到本地（仅当云端严格新于本地才覆盖，否则保留本地）：'}
        </p>
        <ul style={{ margin: 0 }}>
          {selectedKeys.map((k) => {
            const meta = SYNC_TABLE_META.find((m) => m.name === k);
            return <li key={k}>{meta?.label || k}</li>;
          })}
        </ul>
        <p style={{ color: 'var(--color-warning)' }}>
          ⚠️ 目标表会先删除本地/云端同名表数据再写入整表快照，请仅勾选你负责且确认要同步的表。
        </p>
      </Modal>
    </Card>
  );
}