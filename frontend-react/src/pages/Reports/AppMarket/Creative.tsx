/**
 * 应用市场 · 广告创意效果（v3.1 子报表 4/4）
 * 数据源: fact_conv_appmarket (按 广告计划ID 聚合)
 *
 * 字段映射:
 * - 广告计划ID: 唯一标识一个投放计划
 * - counts: 该计划下激活 / 开户 / 入金 / 有效户 计数
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Select, DatePicker, Space, Spin, Table, Tag, Button, Statistic } from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { http } from '@/services/http';
import styles from './index.module.scss';

const { RangePicker } = DatePicker;

interface CreativeRow {
  广告计划ID: number | string;
  应用市场: string;
  渠道类型: string;
  激活APP: number;
  开户成功: number;
  入金: number;
  有效户: number;
  开户成本: number;
  有效率: number;
}

const AppMarketCreativePage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs('2026-01-01'), dayjs('2026-06-30')]);
  const [appMarketFilter, setAppMarketFilter] = useState<string[]>([]);
  const [opts, setOpts] = useState<{ app_markets: string[]; channel_types: string[] }>({ app_markets: [], channel_types: [] });
  const [data, setData] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    http.post('/reports/app-market/filter-options', {}).then((res: any) => {
      if (res?.success) setOpts(res.data);
    }).catch(() => undefined);
  }, []);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    app_markets: appMarketFilter.length ? appMarketFilter : undefined,
  }), [dateRange, appMarketFilter]);

  const load = async () => {
    setLoading(true);
    try {
      // 后端目前无 /creative 端点，前端在客户端按广告计划ID聚合 detail
      const res: any = await http.post('/reports/app-market/detail', { filters, page: 1, page_size: 200 });
      if (res?.success) {
        const map = new Map<string, CreativeRow>();
        (res.data.detail || []).forEach((r: any) => {
          const id = r.id || `${r.下载日期}-${r.应用市场}-${Math.random()}`;
          const key = `${r.广告计划ID || 'unknown'}-${r.应用市场}`;
          const ex = map.get(key) || {
            广告计划ID: r.广告计划ID || '-',
            应用市场: r.应用市场 || '-',
            渠道类型: r.渠道类型 || '-',
            激活APP: 0,
            开户成功: 0,
            入金: 0,
            有效户: 0,
            开户成本: 0,
            有效率: 0,
          };
          if (r.激活APP) ex.激活APP += 1;
          if (r.开户成功) ex.开户成功 += 1;
          if (r.入金) ex.入金 += 1;
          if (r.有效户) ex.有效户 += 1;
          map.set(key, ex);
        });
        const arr = Array.from(map.values());
        arr.forEach((r) => {
          r.有效率 = r.激活APP > 0 ? Number((r.有效户 / r.激活APP * 100).toFixed(2)) : 0;
        });
        arr.sort((a, b) => b.开户成功 - a.开户成功);
        setData(arr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  const topN = data.slice(0, 50);
  const totalPlans = data.length;
  const totalOpen = data.reduce((s, r) => s + r.开户成功, 0);
  const totalValid = data.reduce((s, r) => s + r.有效户, 0);

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
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      </Card>
      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginTop: 16, marginBottom: 16 }}>
          <Col span={8}>
            <Card size='small'>
              <Statistic title='覆盖广告计划数' value={totalPlans} prefix={<ThunderboltOutlined />} valueStyle={{ color: '#1890ff' }} />
              <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>注: 按 detail 前 200 条设备级聚合</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size='small'>
              <Statistic title='Top50 计划开户合计' value={totalOpen} valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size='small'>
              <Statistic title='Top50 计划有效户合计' value={totalValid} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
        </Row>
        <Card title='广告计划 Top 50（按开户成功降序）' size='small'>
          <Table size='small' rowKey={(r: any) => `${r.广告计划ID}-${r.应用市场}`}
            dataSource={topN} pagination={{ pageSize: 20 }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: '排名', width: 60, align: 'center', render: (_: any, __: any, idx: number) => (
                <Tag color={idx < 3 ? 'gold' : idx < 10 ? 'blue' : 'default'}>{idx + 1}</Tag>
              ) },
              { title: '广告计划ID', dataIndex: '广告计划ID', width: 140 },
              { title: '应用市场', dataIndex: '应用市场', width: 100 },
              { title: '渠道类型', dataIndex: '渠道类型', width: 110 },
              { title: '激活APP', align: 'right', render: (v: number) => v.toLocaleString() },
              { title: '开户成功', align: 'right', sorter: (a: any, b: any) => a.开户成功 - b.开户成功, render: (v: number) => v.toLocaleString() },
              { title: '入金', align: 'right', render: (v: number) => v.toLocaleString() },
              { title: '有效户', align: 'right', render: (v: number) => v.toLocaleString() },
              { title: '有效率', align: 'right', render: (v: number) => (
                <Tag color={v > 5 ? 'green' : v > 1 ? 'gold' : 'default'}>{v.toFixed(2)}%</Tag>
              ) },
            ]}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default AppMarketCreativePage;
