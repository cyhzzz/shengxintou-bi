/**
 * 抖音青鸟线索通数据对账 (v3.3.6)
 *
 * 业务定位：
 *   将青鸟线索通回传数据与系统 fact_conv_content 抖音引流线索做联合匹配，
 *   比对 3 个标志位（开口 / 有效 / 开户），输出 4 类对账状态：
 *   - 未匹到：青鸟侧有记录但系统侧抖音引流线索中找不到候选
 *   - 疑似漏打标：青鸟侧某标志位「未打」但系统侧对应标志=1
 *   - 疑似误打标：青鸟侧某标志位「已打」但系统侧对应标志=0
 *   - 正确：3 个标志位两边一致
 *
 * 匹配字段：青鸟侧「微信线索昵称 + 日期」vs 系统侧「微信昵称 + 线索日期」
 * 匹配方式：归一化昵称精确匹配 + 日期容差 ±N 天
 *
 * 数据源: fact_qingniao_leads + fact_conv_content (抖音引流线索)
 * 端点:   POST /api/v1/data-reconciliation/douyin-qingniao/match
 *         GET  /api/v1/data-reconciliation/douyin-qingniao/date-range
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, DatePicker, Empty, message, Segmented, Select, Space, Spin,
  Table, Tag, Tooltip, Typography, Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  CheckCircleOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined,
  WarningOutlined, ExclamationCircleOutlined, CloseCircleOutlined, UploadOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { dataService } from '@/services/dataService';
import { uploadService } from '@/services/uploadService';
import { MetricCard, MetricSection } from '@/components/MetricCard';
import { ReportFooter } from '@/components/ReportFooter';
import { FadeInSection } from '@/components';
import { sanitizeText } from '@/utils/sanitizeText';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface ReconcileRecord {
  企微昵称: string | null;
  线索日期: string | null;
  青鸟昵称: string | null;
  青鸟日期: string | null;
  后台是否开口: string | null;  // '是' / '否' / null
  后台是否有效: string | null;
  后台是否开户: string | null;
  青鸟是否开口: string;        // '是' / '否'
  青鸟是否有效: string;
  青鸟是否开户: string;
  状态: '未匹到' | '疑似漏打标' | '疑似误打标' | '正确';
  差异详情: string | null;
  青鸟线索ID: number;
  客户来源: string | null;
  添加员工姓名: string | null;
}

interface ReconcileSummary {
  qingniao_total: number;
  matched_count: number;
  missed_count: number;
  suspected_missed_tag: number;
  suspected_wrong_tag: number;
  correct_count: number;
}

interface DateRangeResp {
  has_data: boolean;
  min_date: string | null;
  max_date: string | null;
  total: number;
}

const STATUS_TAG_COLOR: Record<ReconcileRecord['状态'], string> = {
  '正确': 'success',
  '疑似漏打标': 'warning',
  '疑似误打标': 'orange',
  '未匹到': 'error',
};

const STATUS_ICON: Record<ReconcileRecord['状态'], React.ReactNode> = {
  '正确': <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />,
  '疑似漏打标': <WarningOutlined style={{ color: '#faad14' }} />,
  '疑似误打标': <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />,
  '未匹到': <CloseCircleOutlined style={{ color: 'var(--color-error)' }} />,
};

const TOLERANCE_OPTIONS = [
  { label: '±0 天（严格匹配）', value: 0 },
  { label: '±1 天', value: 1 },
  { label: '±3 天（推荐）', value: 3 },
  { label: '±7 天（兼容节假日）', value: 7 },
];

const NORMALIZATION_OPTIONS = [
  { label: '方案 A：剥 emoji + 零宽 + NFC（推荐）', value: 'A' },
  { label: '方案 B：剥零宽 + NFC（不处理 emoji）', value: 'B' },
  { label: '方案 C：原样 + 小写（基线对照）', value: 'C' },
];

const STATUS_FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '未匹到', value: '未匹到' },
  { label: '疑似漏打标', value: '疑似漏打标' },
  { label: '疑似误打标', value: '疑似误打标' },
  { label: '正确', value: '正确' },
];

const DouyinQingniaoReconciliationPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [toleranceDays, setToleranceDays] = useState<number>(3);
  const [scheme, setScheme] = useState<'A' | 'B' | 'C'>('A');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [records, setRecords] = useState<ReconcileRecord[]>([]);
  const [summary, setSummary] = useState<ReconcileSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dateRangeInfo, setDateRangeInfo] = useState<DateRangeResp | null>(null);

  // 拉青鸟侧日期范围用于默认填充
  const loadDateRange = async () => {
    try {
      const res: any = await dataService.getDouyinQingniaoDateRange();
      const d = res?.data || res;
      if (d?.has_data && d.min_date && d.max_date) {
        setDateRangeInfo(d);
        setDateRange([dayjs(d.min_date), dayjs(d.max_date)]);
      } else {
        setDateRangeInfo({ has_data: false, min_date: null, max_date: null, total: 0 });
      }
    } catch (e) {
      // 静默
    }
  };

  useEffect(() => { loadDateRange(); }, []);

  // 导入青鸟数据：上传后轮询 status，完成后自动触发对账
  const importProps: UploadProps = {
    accept: '.xlsx,.xls',
    showUploadList: false,
    multiple: false,
    disabled: uploading,
    beforeUpload: (file) => {
      const isValid = /\.(xlsx|xls)$/i.test(file.name);
      if (!isValid) {
        message.error('仅支持 .xlsx / .xls 格式');
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    customRequest: async (options) => {
      const { file, onSuccess, onError } = options;
      setUploading(true);
      try {
        // 1. 上传文件（异步接口，立即返回 task_id）
        const upRes = await uploadService.uploadFile(file as File, 'qingniao_leads' as any, true);
        if (!upRes?.success) {
          message.error(upRes?.message || '上传请求失败');
          onError?.(new Error(upRes?.message || '上传失败'));
          return;
        }
        const taskId = (upRes.data as any)?.task_id;
        if (!taskId) {
          message.error('上传响应缺少 task_id');
          onError?.(new Error('上传响应缺少 task_id'));
          return;
        }

        // 2. 轮询 status 直到 completed / failed（最多等 60s）
        const maxAttempts = 60;
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
        let finalStatus: any = null;
        for (let i = 0; i < maxAttempts; i++) {
          await delay(1000);
          const stRes: any = await dataService.getDouyinQingniaoImportStatus(taskId);
          const d = stRes?.data || stRes;
          if (!d) continue;
          finalStatus = d;
          if (d.status === 'completed' || d.status === 'failed') break;
        }

        if (!finalStatus || finalStatus.status !== 'completed') {
          const errMsg = finalStatus?.message || '导入超时或失败';
          message.error(`导入失败：${errMsg}`);
          onError?.(new Error(errMsg));
          return;
        }

        message.success(`导入成功，共 ${finalStatus.total_rows ?? 0} 行`);

        // 3. 刷新日期范围（拿到刚导入数据的实际日期范围）
        await loadDateRange();

        // 4. 自动触发对账（用刚导入数据的日期范围）
        //    此时 dateRange state 尚未更新，直接调用 handleMatch 会用旧值，
        //    所以这里改为手动传入最新日期范围触发对账
        const rangeRes: any = await dataService.getDouyinQingniaoDateRange();
        const rd = rangeRes?.data || rangeRes;
        if (rd?.has_data && rd.min_date && rd.max_date) {
          const newRange: [Dayjs, Dayjs] = [dayjs(rd.min_date), dayjs(rd.max_date)];
          setDateRange(newRange);
          await runMatchWithRange(newRange, toleranceDays, scheme);
        }

        onSuccess?.({}, new XMLHttpRequest());
      } catch (e: any) {
        message.error(e?.message || '导入请求异常');
        onError?.(e);
      } finally {
        setUploading(false);
      }
    },
  };

  // 共用的对账请求逻辑（手动传入日期范围，避免 state 更新延迟问题）
  const runMatchWithRange = async (
    range: [Dayjs, Dayjs],
    tolerance: number,
    schemeVal: 'A' | 'B' | 'C',
  ) => {
    setLoading(true);
    try {
      const params = {
        start_date: range[0].format('YYYY-MM-DD'),
        end_date: range[1].format('YYYY-MM-DD'),
        date_tolerance_days: tolerance,
        normalization_scheme: schemeVal,
      };
      const res: any = await dataService.getDouyinQingniaoMatch(params);
      const d = res?.data || res;
      if (d?.records && d?.summary) {
        setRecords(d.records);
        setSummary(d.summary);
        return d;
      } else {
        message.warning('对账端点返回数据为空');
        return null;
      }
    } catch (e: any) {
      message.error(e?.message || '对账请求失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!dateRange) {
      message.warning('请选择日期范围');
      return;
    }
    await runMatchWithRange(dateRange, toleranceDays, scheme);
  };

  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return records;
    return records.filter(r => r.状态 === statusFilter);
  }, [records, statusFilter]);

  const handleExport = () => {
    if (!records.length) {
      message.warning('暂无数据可导出');
      return;
    }
    const headers = [
      '青鸟线索ID', '青鸟昵称', '青鸟日期', '企微昵称', '线索日期',
      '后台是否开口', '后台是否有效', '后台是否开户',
      '青鸟是否开口', '青鸟是否有效', '青鸟是否开户',
      '状态', '差异详情', '客户来源', '添加员工姓名',
    ];
    const rows = filteredRecords.map(r => [
      r.青鸟线索ID, r.青鸟昵称 ?? '', r.青鸟日期 ?? '',
      r.企微昵称 ?? '', r.线索日期 ?? '',
      r.后台是否开口 ?? '', r.后台是否有效 ?? '', r.后台是否开户 ?? '',
      r.青鸟是否开口, r.青鸟是否有效, r.青鸟是否开户,
      r.状态, r.差异详情 ?? '', r.客户来源 ?? '', r.添加员工姓名 ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => {
        const s = String(cell ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\n');
    // 加 UTF-8 BOM 以便 Excel 正确识别中文
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `抖音青鸟对账_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: '状态', dataIndex: '状态', key: '状态', width: 120, fixed: 'left' as const,
      render: (s: ReconcileRecord['状态']) => (
        <Tag color={STATUS_TAG_COLOR[s]} icon={STATUS_ICON[s]}>{s}</Tag>
      ),
      filters: [
        { text: '未匹到', value: '未匹到' },
        { text: '疑似漏打标', value: '疑似漏打标' },
        { text: '疑似误打标', value: '疑似误打标' },
        { text: '正确', value: '正确' },
      ],
      onFilter: (val: React.Key | boolean, record: ReconcileRecord) => record.状态 === val,
    },
    {
      title: '青鸟昵称', dataIndex: '青鸟昵称', key: '青鸟昵称', width: 140, fixed: 'left' as const,
      render: (v: string | null) => v ? sanitizeText(v) : <Text type="secondary">—</Text>,
    },
    {
      title: '青鸟日期', dataIndex: '青鸟日期', key: '青鸟日期', width: 110,
      sorter: (a: ReconcileRecord, b: ReconcileRecord) =>
        (a.青鸟日期 ?? '').localeCompare(b.青鸟日期 ?? ''),
    },
    {
      title: '企微昵称', dataIndex: '企微昵称', key: '企微昵称', width: 140,
      render: (v: string | null) => v ? sanitizeText(v) : <Text type="secondary">—</Text>,
    },
    {
      title: '线索日期', dataIndex: '线索日期', key: '线索日期', width: 110,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: '后台是否开口', dataIndex: '后台是否开口', key: '后台是否开口', width: 100,
      render: (v: string | null) => <BoolCell v={v} />,
    },
    {
      title: '后台是否有效', dataIndex: '后台是否有效', key: '后台是否有效', width: 100,
      render: (v: string | null) => <BoolCell v={v} />,
    },
    {
      title: '后台是否开户', dataIndex: '后台是否开户', key: '后台是否开户', width: 100,
      render: (v: string | null) => <BoolCell v={v} />,
    },
    {
      title: '青鸟是否开口', dataIndex: '青鸟是否开口', key: '青鸟是否开口', width: 100,
      render: (v: string) => <BoolCell v={v} />,
    },
    {
      title: '青鸟是否有效', dataIndex: '青鸟是否有效', key: '青鸟是否有效', width: 100,
      render: (v: string) => <BoolCell v={v} />,
    },
    {
      title: '青鸟是否开户', dataIndex: '青鸟是否开户', key: '青鸟是否开户', width: 100,
      render: (v: string) => <BoolCell v={v} />,
    },
    {
      title: '差异详情', dataIndex: '差异详情', key: '差异详情', width: 220,
      render: (v: string | null) => v ? (
        <Tooltip title={v}>
          <Text style={{ fontSize: 12 }}>{v}</Text>
        </Tooltip>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: '客户来源', dataIndex: '客户来源', key: '客户来源', width: 180,
      render: (v: string | null) => v ? sanitizeText(v) : <Text type="secondary">—</Text>,
    },
    {
      title: '添加员工', dataIndex: '添加员工姓名', key: '添加员工姓名', width: 100,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
  ];

  const matchRate = summary
    ? summary.qingniao_total > 0
      ? ((summary.matched_count / summary.qingniao_total) * 100).toFixed(1) + '%'
      : '0%'
    : '-';

  return (
    <div className="page" style={{ padding: 0 }}>
      {/* 筛选卡 */}
      <FadeInSection duration={1.0} delay={0}>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space size="middle" wrap>
            <RangePicker
              value={dateRange as any}
              onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)}
              allowClear={false}
              style={{ width: 260 }}
            />
            <Select
              value={toleranceDays}
              onChange={setToleranceDays}
              options={TOLERANCE_OPTIONS}
              style={{ width: 220 }}
            />
            <Select
              value={scheme}
              onChange={(v) => setScheme(v as 'A' | 'B' | 'C')}
              options={NORMALIZATION_OPTIONS}
              style={{ width: 320 }}
            />
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleMatch}>
              开始对账
            </Button>
            <Upload {...importProps}>
              <Button icon={<UploadOutlined />} loading={uploading}>
                导入青鸟数据
              </Button>
            </Upload>
            <Button icon={<ReloadOutlined />} onClick={() => {
              setRecords([]);
              setSummary(null);
              setStatusFilter('all');
            }}>
              重置
            </Button>
          </Space>
          {dateRangeInfo && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              青鸟数据日期范围：{dateRangeInfo.has_data
                ? `${dateRangeInfo.min_date} ~ ${dateRangeInfo.max_date}（共 ${dateRangeInfo.total} 条）`
                : '暂无青鸟数据，请先在「数据导入」中上传青鸟线索通导出 Excel'}
            </div>
          )}
        </Card>
      </FadeInSection>

      {/* 指标卡 */}
      {summary && (
        <FadeInSection duration={1.0} delay={0.2}>
          <MetricSection>
            <MetricCard
              title="青鸟线索总数"
              value={summary.qingniao_total}
              icon={<SearchOutlined />}
            />
            <MetricCard
              title="已匹到"
              value={summary.matched_count}
              suffix={`/ ${matchRate}`}
              icon={<CheckCircleOutlined />}
              valueColor="var(--color-primary)"
              tooltip={`匹配率：${matchRate}`}
            />
            <MetricCard
              title="未匹到"
              value={summary.missed_count}
              icon={<CloseCircleOutlined />}
              valueColor="var(--color-error)"
              tooltip="青鸟侧有记录但系统侧抖音引流线索中未找到候选"
            />
            <MetricCard
              title="正确"
              value={summary.correct_count}
              icon={<CheckCircleOutlined />}
              valueColor="var(--color-success)"
              tooltip="3 个标志位两边完全一致"
            />
            <MetricCard
              title="疑似漏打标"
              value={summary.suspected_missed_tag}
              icon={<WarningOutlined />}
              valueColor="#faad14"
              tooltip="系统侧标志=1 但青鸟侧对应标志位「未打」"
            />
            <MetricCard
              title="疑似误打标"
              value={summary.suspected_wrong_tag}
              icon={<ExclamationCircleOutlined />}
              valueColor="#fa8c16"
              tooltip="系统侧标志=0 但青鸟侧对应标志位「已打」"
            />
          </MetricSection>
        </FadeInSection>
      )}

      {/* 主表 */}
      <FadeInSection duration={1.0} delay={0.4}>
        <Card
          size="small"
          title={
            <Space size="middle" align="center">
              <Segmented
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as string)}
                options={STATUS_FILTER_OPTIONS}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                共 {filteredRecords.length} 条（全部 {records.length} 条）
              </Text>
            </Space>
          }
          extra={
            <Button
              size="small"
              type="text"
              icon={<DownloadOutlined />}
              disabled={!filteredRecords.length}
              onClick={handleExport}
            >
              导出 CSV
            </Button>
          }
        >
          <Spin spinning={loading}>
            {filteredRecords.length === 0 && !loading ? (
              <Empty description={summary ? '当前筛选下无数据' : '点击「开始对账」开始查询'} />
            ) : (
              <Table
                rowKey="青鸟线索ID"
                columns={columns}
                dataSource={filteredRecords}
                size="small"
                scroll={{ x: 1600 }}
                pagination={{
                  pageSize: 50,
                  showSizeChanger: true,
                  pageSizeOptions: ['20', '50', '100', '200'],
                  showTotal: (total) => `共 ${total} 条`,
                }}
              />
            )}
          </Spin>
        </Card>
      </FadeInSection>

      <FadeInSection duration={1.0} delay={0.6}>
        <ReportFooter
          sources={[
            { label: '数据源', value: 'fact_qingniao_leads + fact_conv_content（抖音引流线索）' },
            { label: '匹配字段', value: '微信线索昵称（青鸟）+ 微信昵称（系统）；日期 + 线索日期（容差 ±N 天）' },
            { label: '对账端点', value: 'POST /api/v1/data-reconciliation/douyin-qingniao/match' },
            { label: '状态判定', value: '系统=1 青鸟=未打 → 疑似漏打标；系统=0 青鸟=已打 → 疑似误打标；3 标志一致 → 正确' },
          ]}
        />
      </FadeInSection>
    </div>
  );
};

// 布尔单元格：是=绿/否=灰，便于扫读
const BoolCell: React.FC<{ v: string | null }> = ({ v }) => {
  if (v === null || v === undefined) return <Text type="secondary">—</Text>;
  if (v === '是') return <Text style={{ color: 'var(--color-success)' }}>是</Text>;
  if (v === '否') return <Text type="secondary">否</Text>;
  return <Text>{v}</Text>;
};

export default DouyinQingniaoReconciliationPage;
