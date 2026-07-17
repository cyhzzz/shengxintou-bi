/**
 * 应用市场 · 设备明细（v3.1.20 重写）
 * 数据源: fact_conv_appmarket（设备级 1 行 = 1 APP 下载）
 * 字段: 与 models_v2.FactConvAppmarket 1:1 全字段展示（33 项含 id）
 * 样式: 与 LeadsDetail（线索明细）保持一致（filter/table/modal 三段同款）
 */
import React, { useEffect, useMemo, useState } from "react";
import { Card, Select, DatePicker, Space, Spin, Table, Tag, Button, Empty, Modal, Descriptions } from "antd";
import { ReloadOutlined, EyeOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { dataServiceReports } from "@/services/dataService";
import { FadeInSection } from '@/components';
import styles from "./index.module.scss";

const { RangePicker } = DatePicker;

const renderBool = (v: any): React.ReactNode =>
  v ? <Tag color="blue">是</Tag> : <Tag>否</Tag>;

const AppMarketDetailPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs("2026-01-01"), dayjs("2026-12-31")]);
  const [appMarketFilter, setAppMarketFilter] = useState<string[]>([]);
  const [channelType, setChannelType] = useState<string[]>([]);
  const [opts, setOpts] = useState<{ app_markets: string[]; channel_types: string[] }>({ app_markets: [], channel_types: [] });
  const [detail, setDetail] = useState<{ rows: any[]; total: number; page: number; page_size: number }>({ rows: [], total: 0, page: 1, page_size: 50 });
  const [loading, setLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  useEffect(() => {
    dataServiceReports.getAppMarketFilterOptions()
      .then((res: any) => { if (res?.success) setOpts(res.data); })
      .catch(() => undefined);
  }, []);

  const filters = useMemo(() => ({
    start_date: dateRange?.[0]?.format("YYYY-MM-DD"),
    end_date: dateRange?.[1]?.format("YYYY-MM-DD"),
    app_markets: appMarketFilter.length ? appMarketFilter : undefined,
    channel_types: channelType.length ? channelType : undefined,
  }), [dateRange, appMarketFilter, channelType]);

  const resetFilters = () => {
    setDateRange([dayjs("2026-01-01"), dayjs("2026-12-31")]);
    setAppMarketFilter([]);
    setChannelType([]);
  };

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

  useEffect(() => { load(1, detail.page_size); }, [filters]);

  return (
    <div className={styles.page}>
      <FadeInSection delay={0} duration={1.2}>
        <Card className={styles.filterCard} size="small">
          <div className={styles.filterRow}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>日期区间:</span>
              <RangePicker value={dateRange} onChange={(v) => v && v[0] && v[1] && setDateRange([v[0], v[1]])} allowClear={false} />
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>应用市场:</span>
              <Select mode="multiple" allowClear placeholder="全部" value={appMarketFilter}
                onChange={setAppMarketFilter}
                options={opts.app_markets.map((m) => ({ label: m, value: m }))}
                style={{ minWidth: 200 }} maxTagCount="responsive" />
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>渠道类型:</span>
              <Select mode="multiple" allowClear placeholder="全部" value={channelType}
                onChange={setChannelType}
                options={opts.channel_types.map((t) => ({ label: t, value: t }))}
                style={{ minWidth: 180 }} maxTagCount="responsive" />
            </div>
            <div className={styles.filterActions}>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => load(1, detail.page_size)}>查询</Button>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
            </div>
          </div>
        </Card>
      </FadeInSection>

      <FadeInSection delay={0.2} duration={1.2}>
        <Card className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>设备明细</span>
            <span className={styles.statText}>共 {detail.total.toLocaleString()} 条</span>
          </div>
          <Spin spinning={loading}>
            <Table size="small" rowKey="id" dataSource={detail.rows}
              scroll={{ x: "max-content" }}
              pagination={{
                current: detail.page, pageSize: detail.page_size, total: detail.total,
                showSizeChanger: true,
                showTotal: (t) => "共 " + t.toLocaleString() + " 条",
                pageSizeOptions: ["20", "50", "100", "200"],
                onChange: (p, ps) => load(p, ps),
              }}
              columns={[
                { title: "下载日期", dataIndex: "下载日期", key: "下载日期", width: 110 },
                { title: "应用市场", dataIndex: "应用市场", key: "应用市场", width: 100 },
                { title: "应用市场名称", dataIndex: "应用市场名称", key: "应用市场名称", width: 140, render: (v: any) => v || "-" },
                { title: "渠道类型", dataIndex: "渠道类型", key: "渠道类型", width: 110 },
                { title: "设备号", dataIndex: "设备号", key: "设备号", width: 180, ellipsis: true },
                { title: "资金账号", dataIndex: "资金账号", key: "资金账号", width: 180, render: (v: any) => v || "-" },
                { title: "激活APP", dataIndex: "激活APP", key: "激活APP", align: "center", width: 90, render: renderBool },
                { title: "开户成功", dataIndex: "开户成功", key: "开户成功", align: "center", width: 90, render: renderBool },
                { title: "新开户", dataIndex: "新开户", key: "新开户", align: "center", width: 80, render: renderBool },
                { title: "入金", dataIndex: "入金", key: "入金", align: "center", width: 80, render: renderBool },
                { title: "有效户", dataIndex: "有效户", key: "有效户", align: "center", width: 80, render: renderBool },
                {
                  title: "操作", key: "action", width: 80, fixed: "right" as const, align: "center",
                  render: (_: any, record: any) => (
                    <Button type="link" size="small" icon={<EyeOutlined />}
                      onClick={() => { setSelectedRow(record); setDetailModalOpen(true); }}>
                      详情
                    </Button>
                  ),
                },
              ]}
              locale={{ emptyText: <Empty description="无明细" /> }}
            />
          </Spin>
        </Card>
      </FadeInSection>

      <Modal
        title="设备明细详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={800}
        className={styles.detailModal}
      >
        {selectedRow && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="数据更新日期">{selectedRow["数据更新日期"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="下载日期">{selectedRow["下载日期"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="应用市场">{selectedRow["应用市场"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="应用市场名称">{selectedRow["应用市场名称"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="渠道类型">{selectedRow["渠道类型"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="投放账号">{selectedRow["投放账号"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="广告计划ID">{selectedRow["广告计划ID"] ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="设备号">{selectedRow["设备号"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="注册手机号">{selectedRow["注册手机号"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否注册身份证">{renderBool(selectedRow["是否注册身份证"])}</Descriptions.Item>
            <Descriptions.Item label="注册身份证时间">{selectedRow["注册身份证时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否注册银行卡">{renderBool(selectedRow["是否注册银行卡"])}</Descriptions.Item>
            <Descriptions.Item label="注册银行卡时间">{selectedRow["注册银行卡时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否激活APP">{renderBool(selectedRow["是否激活APP"])}</Descriptions.Item>
            <Descriptions.Item label="APP激活时间">{selectedRow["APP激活时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否开户注册">{renderBool(selectedRow["是否开户注册"])}</Descriptions.Item>
            <Descriptions.Item label="注册开户流程时间">{selectedRow["注册开户流程时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否提交开户">{renderBool(selectedRow["是否提交开户"])}</Descriptions.Item>
            <Descriptions.Item label="提交开户时间">{selectedRow["提交开户时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否开户成功">{renderBool(selectedRow["是否开户成功"])}</Descriptions.Item>
            <Descriptions.Item label="开户成功时间">{selectedRow["开户成功时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="开户时间">{selectedRow["开户时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否新开户">{renderBool(selectedRow["是否新开户"])}</Descriptions.Item>
            <Descriptions.Item label="是否创建完资金账号">{renderBool(selectedRow["是否创建完资金账号"])}</Descriptions.Item>
            <Descriptions.Item label="资金账号创建完成时间">{selectedRow["资金账号创建完成时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="资金账号">{selectedRow["资金账号"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否入金">{renderBool(selectedRow["是否入金"])}</Descriptions.Item>
            <Descriptions.Item label="是否有效户">{renderBool(selectedRow["是否有效户"])}</Descriptions.Item>
            <Descriptions.Item label="有效户时间">{selectedRow["有效户时间"] || "-"}</Descriptions.Item>
            <Descriptions.Item label="是否存量客户">{renderBool(selectedRow["是否存量客户"])}</Descriptions.Item>
            <Descriptions.Item label="总资产">{selectedRow["总资产"] ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="累计创收">{selectedRow["累计创收"] ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="人均日创收">{selectedRow["人均日创收"] ?? "-"}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AppMarketDetailPage;
