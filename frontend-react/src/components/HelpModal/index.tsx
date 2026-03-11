import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { dataService } from '@/services';
import styles from './index.module.scss';

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
        icon={<QuestionCircleOutlined style={{ fontSize: 20 }} />}
      />
      <Modal
        title="关于省心投平台"
        open={visible}
        onCancel={() => setVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setVisible(false)}>
            知道了
          </Button>,
        ]}
        width={600}
        className={styles.helpModal}
      >
        <div className={styles.helpContent}>
          {/* Logo */}
          <div className={styles.logoSection}>
            <img src="/icons/logo-横版.png" alt="省心投" className={styles.logoImage} />
          </div>

          {/* 项目简介 */}
          <section className={styles.helpSection}>
            <h4>项目简介</h4>
            <p>
              省心投平台是一个轻量级互联网广告投放分析平台，提供多平台广告数据聚合、分析和可视化功能。
            </p>
            <p className={styles.warning}>
              本平台仅供申万宏源证券 - 财富管理事业部 - 渠道建设部内部使用，数据仅供参考。
            </p>
          </section>

          {/* 核心功能 */}
          <section className={styles.helpSection}>
            <h4>核心功能</h4>
            <ul>
              <li><strong>数据概览</strong> - 整体数据概览，展示核心指标和趋势</li>
              <li><strong>转化漏斗</strong> - 从转化率角度针对性查看和分析</li>
              <li><strong>线索明细</strong> - 所有客户线索到转化的数据明细</li>
              <li><strong>厂商分析</strong> - 代理商投放和转化数据分析</li>
              <li><strong>小红书</strong> - 笔记列表、运营分析</li>
              <li><strong>员工转化</strong> - 服务人员转化效果分析与周报生成</li>
            </ul>
          </section>

          {/* 版本信息 */}
          <section className={styles.helpSection}>
            <h4>版本信息</h4>
            {loading ? (
              <p>加载中...</p>
            ) : versionInfo ? (
              <div>
                <p>版本：v{versionInfo.version}</p>
                <p>更新时间：{versionInfo.release_date}</p>
                {versionInfo.changelog && versionInfo.changelog.length > 0 && (
                  <ul>
                    {versionInfo.changelog.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p>版本信息加载失败</p>
            )}
          </section>

          {/* 创建者信息 */}
          <section className={styles.creatorSection}>
            <div className={styles.creatorInfo}>
              <img src="/icons/陈元昊肖像.svg" alt="陈元昊" className={styles.creatorAvatar} />
              <div>
                <p className={styles.creatorName}>创建者：陈元昊</p>
                <p className={styles.creatorOrg}>申万宏源证券 - 财富管理事业部 - 产品经理</p>
              </div>
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
};

export default HelpModal;