/**
 * 直播获客 · 占位页（v3.1）
 * 数据源: 当前无直播明细（数据源目录无相关 Excel）
 * 计划: v3.1 仅占位，等业务侧提供数据后 v3.2 实现完整漏斗
 */
import React from 'react';
import { Card, Result, Button, Space, Alert, Tag } from 'antd';
import { ClockCircleOutlined, ApiOutlined, FileTextOutlined } from '@ant-design/icons';

const LiveFunnelPage: React.FC = () => {
  return (
    <Card>
      <Result
        icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
        title='直播获客漏斗（占位）'
        subTitle='当前无直播数据源接入。等待业务侧提供「直播明细表.xlsx」后实现完整漏斗报表。'
        extra={
          <Space direction='vertical' size='middle' style={{ marginTop: 16, width: '100%' }}>
            <Alert
              type='info'
              showIcon
              message='接入规范（v3.2 准备）'
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>预计数据源: 直播明细表.xlsx（按日/平台/主播/商品/漏斗阶段）</li>
                  <li>落库新表: <code>fact_live</code>（DWD，列：日期/平台/主播/直播场次ID/观看UV/互动量/加微数/开户数/有效户数/总资产/创收）</li>
                  <li>维度表: <code>dim_anchor</code>（主播字典：姓名/平台/签约时间/状态）</li>
                  <li>漏斗: 观看UV → 互动 → 加微 → 开户 → 有效户</li>
                </ul>
              }
            />
            <Space>
              <Tag icon={<ApiOutlined />} color='blue'>v3.1 占位状态</Tag>
              <Tag icon={<FileTextOutlined />} color='purple'>v3.2 待数据源</Tag>
            </Space>
          </Space>
        }
      />
    </Card>
  );
};

export default LiveFunnelPage;
