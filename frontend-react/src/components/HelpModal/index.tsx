import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Card, Row, Col, Typography } from 'antd';
import { QuestionCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { dataService } from '@/services';
import { DataFreshnessIndicator, type DataFreshnessIndicatorRef } from '@/components/DataFreshness';
import styles from './index.module.scss';

const { Text, Paragraph } = Typography;

interface VersionInfo {
  version: string;
  release_date: string;
  changelog?: string[];
  support_contact?: string;
}

interface HelpModalProps {
  className?: string;
}

export const HelpModal: React.FC<HelpModalProps> = ({ className }) => {
  const [visible, setVisible] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const dataFreshnessRef = useRef<DataFreshnessIndicatorRef>(null);

  const loadVersionInfo = async () => {
    setLoading(true);
    try {
      const response = await dataService.getVersion();
      if (response.success && response.data) {
        setVersionInfo(response.data);
      }
    } catch (error) {
      console.error('加载版本信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadVersionInfo();
    dataFreshnessRef.current?.refresh();
  };

  useEffect(() => {
    if (visible) {
      loadVersionInfo();
    }
  }, [visible]);

  return (
    <>
      <Button
        className={`${styles.helpBtn} ${className || ''}`}
        type="text"
        onClick={() => setVisible(true)}
        icon={<QuestionCircleOutlined style={{ fontSize: 16 }} />}
      />
      <Modal
        title={null}
        open={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        width={720}
        className={styles.helpModal}
        centered
      >
        <div className={styles.helpContent}>
          {/* Logo 区域 */}
          <div className={styles.logoSection}>
            <img src="/icons/logo-横版.png" alt="省心投" className={styles.logoImage} />
          </div>

          {/* 主要内容区域 - 两列布局 */}
          <Row gutter={16}>
            {/* 左列：项目简介 + 核心功能 + 版本信息 */}
            <Col span={12}>
              <Card
                title="项目简介"
                size="small"
                className={styles.infoCard}
              >
                <Paragraph className={styles.description}>
                  省心投平台是一个轻量级互联网广告投放分析平台，提供多平台广告数据聚合、分析和可视化功能。
                </Paragraph>
                <div className={styles.warning}>
                  ⚠️ 本平台仅供申万宏源证券 - 财富管理事业部 - 渠道建设部内部使用，数据仅供参考。
                </div>
              </Card>

              <Card
                title="核心功能"
                size="small"
                className={styles.infoCard}
              >
                <ul className={styles.featureList}>
                  <li><strong>数据概览</strong> - 整体数据概览，展示核心指标和趋势</li>
                  <li><strong>转化漏斗</strong> - 从转化率角度针对性查看和分析</li>
                  <li><strong>线索明细</strong> - 所有客户线索到转化的数据明细</li>
                  <li><strong>厂商分析</strong> - 代理商投放和转化数据分析</li>
                  <li><strong>小红书</strong> - 笔记列表、运营分析</li>
                  <li><strong>员工转化</strong> - 服务人员转化效果分析与周报生成</li>
                </ul>
              </Card>

              <Card
                title="版本信息"
                size="small"
                className={styles.infoCard}
              >
                {loading ? (
                  <Text type="secondary">加载中...</Text>
                ) : versionInfo ? (
                  <div className={styles.versionInfo}>
                    <div className={styles.versionRow}>
                      <Text type="secondary">版本：</Text>
                      <Text strong>v{versionInfo.version}</Text>
                    </div>
                    <div className={styles.versionRow}>
                      <Text type="secondary">更新时间：</Text>
                      <Text>{versionInfo.release_date}</Text>
                    </div>
                    {versionInfo.changelog && versionInfo.changelog.length > 0 && (
                      <div className={styles.changelog}>
                        <Text type="secondary">更新内容：</Text>
                        <ul>
                          {versionInfo.changelog.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <Text type="secondary">版本信息加载失败</Text>
                )}
              </Card>
            </Col>

            {/* 右列：数据状态 + 创建者 */}
            <Col span={12}>
              <Card
                title="数据状态"
                size="small"
                className={styles.infoCard}
                extra={<SyncOutlined onClick={handleRefresh} className={styles.refreshIcon} />}
              >
                <DataFreshnessIndicator
                  ref={dataFreshnessRef}
                  showActions={false}
                />
              </Card>

              <Card
                title="创建者"
                size="small"
                className={styles.infoCard}
              >
                <div className={styles.creatorInfo}>
                  <img src="/icons/陈元昊肖像.svg" alt="陈元昊" className={styles.creatorAvatar} />
                  <div>
                    <Text strong>陈元昊</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      申万宏源证券 - 财富管理事业部 - 产品经理
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </Modal>
    </>
  );
};

export default HelpModal;