/**
 * 应用市场 · 设备明细（v3.1 子报表 3/4）
 * 数据源: fact_conv_appmarket (设备级)
 * 列: 设备号 / 应用市场 / 下载日期 / 激活 / 开户 / 有效户 / 资产
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Empty, Modal, Descriptions } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { dataServiceReports } from '@/services/dataService';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

const AppMarketDetailPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-12-31')]);
  const [appMarketFilter, setAppMarketFilter] = useState<string[]>([]);
  const [channelType, setChannelType] = useState<string[]>([]);
  const [opts, setOpts] = useState<{ app_markets: string[]; channel_types: string[] }>({ app_markets: [], channel_types: [] });
  const [detail, setDetail] = useState<{ rows: any[]; total: number; page: number; page_size: number }>({ rows: [], total: 0, page: 1, page_size: 50 });
  const [loading, setLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  useEffect(() => {
    dataServiceReports.getAppMarketFilterOptions().then((res: any) => {
      if (res?.success) setOpts(res.data);
    }).catch(() => undefined);
  }, []);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    app_markets: appMarketFilter.length ? appMarketFilter : undefined,
    channel_types: channelType.length ? channelType : undefined,
  }), [dateRange, appMarketFilter, channelType]);

  const load = async (page = 1, page_size = 50) => {
    setLoading(true);
    try {
      const res: any = await dataServiceReports.getAppMarketDetail({ filters, page, page_size });
      if (res?.success) {
        setDetail({ rows: res.data.detail, total: res.data.total, page: res.data.page, page_size: res.data.page_size });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, detail.page_size); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  return (
    <div className={styles.page}>
      <Card className={styles.filterCard} size='small'>
        <Space size='middle' wrap>
          <span className={styles.label}>日期区间</span>
          <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
          <span className={styles.label}>应用市场</span>
          <Select mode='multiple' allowClear placeholder='全部' value={appMarketFilter}
            onChange={setAppMarketFilter} options={opts.app_markets.map((m) => ({ label: m, value: m }))}
            style={{ minWidth: 200 }} maxTagCount='responsive' />
          <span className={styles.label}>渠道类型</span>
          <Select mode='multiple' allowClear placeholder='全部' value={channelType}
            onChange={setChannelType} options={opts.channel_types.map((t) => ({ label: t, value: t }))}
            style={{ minWidth: 180 }} maxTagCount='responsive' />
          <Button icon={<ReloadOutlined />} onClick={() => load(1, detail.page_size)}>刷新</Button>
        </Space>
      </Card>
      <Card title={`设备明细（设备级，共 ${detail.total.toLocaleString()} 条）`} size='small' style={{ marginTop: 16 }}>
        <Spin spinning={loading}>
          <Table size='small' rowKey='id' dataSource={detail.rows}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: detail.page,
              pageSize: detail.page_size,
              total: detail.total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t.toLocaleString()} 条`,
              pageSizeOptions: ['20', '50', '100', '200'],
              onChange: (p, ps) => load(p, ps),
            }}
            columns={[
              { title: '下载日期', dataIndex: '下载日期', width: 110 },
              { title: '应用市场', dataIndex: '应用市场', width: 100 },
              { title: '渠道类型', dataIndex: '渠道类型', width: 110 },
              { title: '设备号', dataIndex: '设备号', width: 180, ellipsis: true },
              { title: '资金账号', dataIndex: '资金账号', width: 180, render: (v: any) => v || '-' },
              { title: '激活APP', align: 'center', width: 90, render: (v: any) => v ? <Tag color='blue'>是</Tag> : <Tag>否</Tag> },
              { title: '开户成功', align: 'center', width: 90, render: (v: any) => v ? <Tag color='green'>是</Tag> : <Tag>否</Tag> },
              { title: '新开户', align: 'center', width: 80, render: (v: any) => v ? <Tag color='cyan'>是</Tag> : <Tag>否</Tag> },
              { title: '入金', align: 'center', width: 80, render: (v: any) => v ? <Tag color='purple'>是</Tag> : <Tag>否</Tag> },
              { title: '有效户', align: 'center', width: 80, render: (v: any) => v ? <Tag color='magenta'>是</Tag> : <Tag>否</Tag> },
              {
                title: '操作', width: 80, fixed: 'right' as const, align: 'center',
                render: (_: any, record: any) => (
                  <Button type='link' size='small' icon={<EyeOutlined />}
                    onClick={() => { setSelectedRow(record); setDetailModalOpen(true); }}>
                    详情
                  </Button>
                ),
              },
            ]}
            locale={{ emptyText: <Empty description='无明细' /> }}
          />
        </Spin>
      </Card>

      <Modal
        title='设备明细详情'
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={760}
      >
        {selectedRow && (
          <Descriptions column={2} bordered size='small'>
            <Descriptions.Item label='下载日期'>{selectedRow['下载日期'] || '-'}</Descriptions.Item>
            <Descriptions.Item label='应用市场'>{selectedRow['应用市场'] || '-'}</Descriptions.Item>
            <Descriptions.Item label='渠道类型'>{selectedRow['渠道类型'] || '-'}</Descriptions.Item>
            <Descriptions.Item label='设备号'>{selectedRow['设备号'] || '-'}</Descriptions.Item>
            <Descriptions.Item label='资金账号'>{selectedRow['资金账号'] || '-'}</Descriptions.Item>
            <Descriptions.Item label='激活 APP'>{selectedRow['激活APP'] ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label='开户成功'>{selectedRow['开户成功'] ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label='新开户'>{selectedRow['新开户'] ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label='入金'>{selectedRow['入金'] ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label='有效户'>{selectedRow['有效户'] ? '是' : '否'}</Descriptions.Item>
            {Object.keys(selectedRow)
              .filter((k) => !['下载日期','应用市场','渠道类型','设备号','资金账号','激活APP','开户成功','新开户','入金','有效户','id'].includes(k))
              .map((k) => (
                <Descriptions.Item key={k} label={k}>{selectedRow[k] ?? '-'}</Descriptions.Item>
              ))}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AppMarketDetailPage;
