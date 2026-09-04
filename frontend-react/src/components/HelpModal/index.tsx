import React, { useState, useEffect, useRef } from "react";
import { Modal, Button, Card, Row, Col, Typography, Badge, Tag, Space, Tooltip, Progress, App as AntApp } from "antd";
import { QuestionCircleOutlined, SyncOutlined, CloudDownloadOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { dataService } from "@/services";
import { DataFreshnessIndicator, type DataFreshnessIndicatorRef } from "@/components/DataFreshness";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { featureFlags } from "@/config/features";
import { isDesktopClient, isMobileClient } from "@/utils/isDesktop";
import styles from "./index.module.scss";

// v3.5.8：桌面版（Electron 打包后）无 git 仓库，git pull 会失败。
// 桌面版改为直接跳转 GitHub Release 页面让用户下载新安装包。
const RELEASE_URL = "https://github.com/cyhzzz/shengxintou-bi/releases/latest";

const { Text, Paragraph, Link } = Typography;

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
  const { message: antdMessage } = AntApp.useApp();
  // v3.1.17: 自更新状态机
  const [gitBusy, setGitBusy] = useState(false);
  const [gitStatus, setGitStatus] = useState<{
    available?: boolean;
    branch?: string;
    local_sha?: string;
    remote_sha?: string;
    dirty?: boolean;
    local_version?: string;
    error?: string;
  } | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateTaskId, setUpdateTaskId] = useState<string | null>(null);
  // 进度弹窗当前跟踪的任务类型（决定成功后页脚动作：git/frontend → 刷新页面；full → 引导重启生效）
  const [updateTaskType, setUpdateTaskType] = useState<'git' | 'frontend' | 'full' | null>(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStage, setUpdateStage] = useState<string>("");
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updateResult, setUpdateResult] = useState<{
    status: string;
    before_version?: string;
    after_version?: string;
    message?: string;
    error?: string;
  } | null>(null);
  // v3.7.0：前端热更新（Windows Electron / Android Capacitor 共用）
  // - 桌面版：调后端 /system/frontend-update/start，1s 轮询 status
  // - 移动版：同步调用 Capacitor Updater，无轮询（直接 onProgress 推进）
  const [frontendUpdateBusy, setFrontendUpdateBusy] = useState(false);
  const [frontendUpdateTaskId, setFrontendUpdateTaskId] = useState<string | null>(null);
  // v3.9.0：Windows 完整静默更新（后端+前端+版本号一起，重启生效）
  const [fullUpdateBusy, setFullUpdateBusy] = useState(false);
  const [fullUpdateTaskId, setFullUpdateTaskId] = useState<string | null>(null);
  const [stagingReady, setStagingReady] = useState<{ ready: boolean; version?: string }>({ ready: false });
  const [applyingFullUpdate, setApplyingFullUpdate] = useState(false);

  const dataFreshnessRef = useRef<DataFreshnessIndicatorRef>(null);
  const {
    hasUpdate,
    remoteVersion,
    remoteReleaseDate,
    remoteChangelog,
    reachable,
    loading: remoteLoading,
    refresh: refreshRemote,
  } = useVersionCheck();

  const loadVersionInfo = async () => {
    setLoading(true);
    try {
      const response = await dataService.getVersion();
      if (response.success && response.data) {
        setVersionInfo(response.data);
      }
    } catch (error) {
      console.error("load version failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadGitStatus = async () => {
    try {
      const r = await dataService.getGitStatus();
      if (r.success && r.data) setGitStatus(r.data);
    } catch (e) {
      // 静默失败：仅控制台记录，不影响主流程
      console.warn("loadGitStatus failed", e);
    }
  };

  const startSelfUpdate = async (force: boolean) => {
    setGitBusy(true);
    setUpdateProgress(5);
    setUpdateStage("提交更新任务...");
    setUpdateLog([]);
    setUpdateResult(null);
    setUpdateTaskType("git");
    try {
      const r = await dataService.selfUpdateStart(force);
      if (!r.success || !r.data) {
        antdMessage.error(r.message || "启动更新失败");
        setGitBusy(false);
        return;
      }
      setUpdateTaskId(r.data.task_id);
    } catch (e: any) {
      antdMessage.error("启动更新异常：" + (e?.message || e));
      setGitBusy(false);
    }
  };

  // v3.7.0：Windows 桌面版前端热更新（后端拉 zip 覆盖 dist）
  const startFrontendUpdate = async () => {
    setFrontendUpdateBusy(true);
    setUpdateProgress(5);
    setUpdateStage("提交前端热更新任务...");
    setUpdateLog([]);
    setUpdateResult(null);
    setUpdateTaskType("frontend");
    try {
      const r = await dataService.frontendUpdateStart();
      if (!r.success || !r.data) {
        antdMessage.error(r.message || "启动前端热更新失败");
        setFrontendUpdateBusy(false);
        return;
      }
      setFrontendUpdateTaskId(r.data.task_id);
    } catch (e: any) {
      antdMessage.error("启动前端热更新异常：" + (e?.message || e));
      setFrontendUpdateBusy(false);
    }
  };

  // v3.9.0：完整静默更新（桌面版 Electron）——
  //   staging 已就绪 → 直接提示重启；未就绪 → 调后端下载 full-update.zip 并轮询
  const checkFullUpdateStaging = async () => {
    if (!isDesktopClient() || !window.desktopUpdater) return;
    try {
      const s = await window.desktopUpdater.checkStaging();
      setStagingReady(s);
    } catch {
      setStagingReady({ ready: false });
    }
  };

  const startFullUpdate = async () => {
    setFullUpdateBusy(true);
    setUpdateProgress(5);
    setUpdateStage("准备完整更新...");
    setUpdateLog([]);
    setUpdateResult(null);
    // 立即打开进度弹窗：完整更新包下载需要数分钟，若不弹窗则点击后零可见反馈（无反应）
    setUpdateModalOpen(true);
    setUpdateTaskType("full");
    try {
      const r = await dataService.fullUpdateStart();
      if (!r.success || !r.data) {
        // 失败展示在弹窗内（持久），而不是一闪而过的 toast，避免看起来像"没反应"
        setUpdateResult({ status: "failed", message: r.message || "启动完整更新失败" });
        setFullUpdateBusy(false);
        return;
      }
      setFullUpdateTaskId(r.data.task_id);
    } catch (e: any) {
      setUpdateResult({ status: "failed", message: "启动完整更新异常：" + (e?.message || e) });
      setFullUpdateBusy(false);
    }
  };

  const applyFullUpdateAndRestart = async () => {
    if (!window.desktopUpdater) return;
    setApplyingFullUpdate(true);
    setUpdateStage("正在应用更新并重启服务...");
    try {
      const res = await window.desktopUpdater.applyAndRestart();
      if (res?.ok) {
        if (res.restarting) {
          antdMessage.success(`已更新到 v${res.version || ""}，应用将自动重启生效...`);
        } else {
          antdMessage.success(`已更新到 v${res.version || ""}，正在刷新...`);
          setStagingReady({ ready: false });
        }
      } else {
        antdMessage.error("应用更新失败：" + (res?.error || "未知错误"));
      }
    } catch (e: any) {
      antdMessage.error("应用更新异常：" + (e?.message || e));
    } finally {
      setApplyingFullUpdate(false);
    }
  };

  const handleRefresh = () => {
    loadVersionInfo();
    dataFreshnessRef.current?.refresh();
    refreshRemote();
  };

  useEffect(() => {
    if (visible) {
      loadVersionInfo();
      loadGitStatus();
    }
  }, [visible]);

  // v3.1.17: 自更新任务状态轮询
  useEffect(() => {
    if (!updateTaskId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await dataService.selfUpdateStatus(updateTaskId);
        if (cancelled) return;
        if (r.success && r.data) {
          const d = r.data;
          setUpdateStage(d.message || "");
          setUpdateLog(d.log || []);
          setUpdateProgress(d.progress ?? 50);
          if (d.status === "success") {
            setUpdateResult({
              status: "success",
              before_version: d.before_version,
              after_version: d.after_version,
              message: d.message,
            });
            setUpdateProgress(100);
            setGitBusy(false);
            // 重新拉本地版本
            loadVersionInfo();
            loadGitStatus();
            antdMessage.success("代码已更新，刷新页面 + 重启 Flask 即可生效");
            return;
          } else if (d.status === "failed") {
            setUpdateResult({
              status: "failed",
              message: d.message,
              error: d.error,
            });
            setGitBusy(false);
            return;
          } else if (d.status === "completed_with_conflicts") {
            setUpdateResult({
              status: "completed_with_conflicts",
              message: d.message,
              error: d.error,
            });
            setGitBusy(false);
            return;
          }
        }
      } catch (e) {
        console.warn("poll self-update failed", e);
      }
      // 1s 后再次轮询
      setTimeout(tick, 1000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [updateTaskId]);

  // 当有 updateTaskId 时自动打开进度 Modal
  useEffect(() => {
    if (updateTaskId) setUpdateModalOpen(true);
  }, [updateTaskId]);

  // v3.7.0：前端热更新任务状态轮询（仅 Windows 桌面版走这条路径）
  useEffect(() => {
    if (!frontendUpdateTaskId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await dataService.frontendUpdateStatus(frontendUpdateTaskId);
        if (cancelled) return;
        if (r.success && r.data) {
          const d = r.data;
          setUpdateStage(d.message || "");
          setUpdateLog(d.log || []);
          setUpdateProgress(d.progress ?? 50);
          if (d.status === "completed") {
            setUpdateResult({
              status: "success",
              message: d.message,
            });
            setUpdateProgress(100);
            setFrontendUpdateBusy(false);
            loadVersionInfo();
            antdMessage.success("前端热更新完成，刷新页面生效");
            return;
          } else if (d.status === "failed") {
            setUpdateResult({
              status: "failed",
              message: d.message,
              error: d.error,
            });
            setFrontendUpdateBusy(false);
            return;
          }
        }
      } catch (e) {
        console.warn("poll frontend-update failed", e);
      }
      setTimeout(tick, 1000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [frontendUpdateTaskId]);

  // 当有 frontendUpdateTaskId 时自动打开进度 Modal
  useEffect(() => {
    if (frontendUpdateTaskId) setUpdateModalOpen(true);
  }, [frontendUpdateTaskId]);

  // 当有 fullUpdateTaskId 时自动打开进度 Modal（兜底：任何路径启动完整更新都可见反馈）
  useEffect(() => {
    if (fullUpdateTaskId) setUpdateModalOpen(true);
  }, [fullUpdateTaskId]);

  // v3.9.0：完整更新下载轮询（桌面版）——完成后检查 staging 就绪
  useEffect(() => {
    if (!fullUpdateTaskId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await dataService.fullUpdateStatus(fullUpdateTaskId);
        if (cancelled) return;
        if (r.success && r.data) {
          const d = r.data;
          setUpdateStage(d.message || "");
          setUpdateLog(d.log || []);
          setUpdateProgress(d.progress ?? 50);
          if (d.status === "completed") {
            setUpdateTaskType("full");
            setUpdateResult({ status: "success", message: d.message });
            setUpdateProgress(100);
            setFullUpdateBusy(false);
            setFullUpdateTaskId(null);
            await checkFullUpdateStaging();
            antdMessage.success("完整更新包已就绪，点击「重启应用生效」即可应用。");
            return;
          } else if (d.status === "failed") {
            setUpdateResult({ status: "failed", message: d.message, error: d.error });
            setFullUpdateBusy(false);
            setFullUpdateTaskId(null);
            return;
          }
        }
      } catch (e) {
        console.warn("poll full-update failed", e);
      }
      setTimeout(tick, 1500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [fullUpdateTaskId]);

  // v3.9.0：打开帮助 Modal 时检查是否有已下载待应用的完整更新
  useEffect(() => {
    if (visible) checkFullUpdateStaging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <>
      <Tooltip
        title={hasUpdate ? `省心投BI 发现新版本 v${remoteVersion}，点点看查` : "帮助 / 关于"}
        placement="bottom"
      >
        <Badge dot={hasUpdate} color="#f5222d" offset={[-4, 4]}>
          <Button
            className={`${styles.helpBtn} ${className || ""}`}
            type="text"
            onClick={() => setVisible(true)}
            icon={<QuestionCircleOutlined style={{ fontSize: 16 }} />}
          />
        </Badge>
      </Tooltip>
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
          <div className={styles.logoSection}>
            <img src={`${import.meta.env.BASE_URL}icons/logo-横版.png`} alt="省心投" className={styles.logoImage} />
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Card title="项目简介" size="small" className={styles.infoCard}>
                <Paragraph className={styles.description}>
                  shengxintou 平台 是一个轻量级互联网广告投放分析平台，提供多平台广告数据聚合、分析和可视化。
                </Paragraph>
                <div className={styles.warning}>
                  ⚠️ 本平台仅供申万宏源证券 - 财富管理事业部 - 渠道建设部内部使用，数据仅供参考。
                </div>
              </Card>

              <Card title="核心功能" size="small" className={styles.infoCard}>
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
                extra={
                  <Tooltip title="刷新本地与 GitHub 最新版本">
                    <SyncOutlined
                      spin={loading || remoteLoading}
                      onClick={handleRefresh}
                      className={styles.refreshIcon}
                    />
                  </Tooltip>
                }
              >
                {loading && !versionInfo ? (
                  <Text type="secondary">加载中...</Text>
                ) : versionInfo ? (
                  <div className={styles.versionInfo}>
                    <div className={styles.versionRow}>
                      <Text type="secondary">当前版本：</Text>
                      <Text strong>v{versionInfo.version}</Text>
                    </div>
                    <div className={styles.versionRow}>
                      <Text type="secondary">发布时间：</Text>
                      <Text>{versionInfo.release_date}</Text>
                    </div>

                    <div className={styles.githubVersionBlock}>
                      <div className={styles.versionRow}>
                        <Text type="secondary">GitHub 最新：</Text>
                        {!reachable ? (
                          <Tag color="default" icon={<CloudDownloadOutlined />}>
                            未联网
                          </Tag>
                        ) : hasUpdate ? (
                          <Space size={6}>
                            <Tag color="red" icon={<CloudDownloadOutlined />}>
                              v{remoteVersion}（可更新）
                            </Tag>
                          </Space>
                        ) : (
                          <Tag color="green" icon={<CheckCircleOutlined />}>
                            v{remoteVersion} 已是最新
                          </Tag>
                        )}
                      </div>
                      {reachable && remoteReleaseDate && (
                        <div className={styles.versionRow}>
                          <Text type="secondary">github 发布时间：</Text>
                          <Text>{remoteReleaseDate}</Text>
                        </div>
                      )}
                      {hasUpdate && remoteChangelog && remoteChangelog.length > 0 && (
                        <div className={styles.changelog}>
                          <Text type="secondary">v{remoteVersion} 本次更新内容：</Text>
                          <ul>
                            {remoteChangelog.slice(0, 6).map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!reachable && (
                        <div className={styles.networkHint}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            无法访问 GitHub，已跳过版本对比，不影响报表加载。
                          </Text>
                        </div>
                      )}
                      <div className={styles.updateTip}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          仓库：
                          <Link
                            href="https://github.com/cyhzzz/shengxintou-bi"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            cyhzzz/shengxintou-bi
                          </Link>
                          {isDesktopClient()
                            ? "，新版安装包见 Release 页面"
                            : isMobileClient()
                            ? "，新版 APK 见 Release 页面"
                            : "，可用 git pull 拉取最新代码"}
                        </Text>
                      </div>
                      {featureFlags.showGithubSyncButton && (
                        isDesktopClient() ? (
                          <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            {hasUpdate && (
                              stagingReady.ready ? (
                                <Button
                                  type="primary"
                                  icon={<CloudDownloadOutlined />}
                                  loading={applyingFullUpdate}
                                  onClick={applyFullUpdateAndRestart}
                                  className={styles.updateBtn}
                                  block
                                >
                                  重启应用生效（v{stagingReady.version || remoteVersion}）
                                </Button>
                              ) : (
                                <Button
                                  type="primary"
                                  icon={<CloudDownloadOutlined />}
                                  loading={fullUpdateBusy}
                                  onClick={startFullUpdate}
                                  className={styles.updateBtn}
                                  block
                                >
                                  下载并更新到 v{remoteVersion}（后端+前端，重启生效）
                                </Button>
                              )
                            )}
                            <Button
                              icon={<CloudDownloadOutlined />}
                              loading={frontendUpdateBusy}
                              onClick={startFrontendUpdate}
                              className={styles.updateBtn}
                              block
                            >
                              前端热更新（无需重装）
                            </Button>
                            <Button
                              icon={<CloudDownloadOutlined />}
                              onClick={() => window.open(RELEASE_URL, "_blank", "noopener,noreferrer")}
                              className={styles.updateBtn}
                              block
                            >
                              前往 GitHub 下载新版安装包
                            </Button>
                          </Space>
                        ) : isMobileClient() ? (
                          <Button
                            type="primary"
                            icon={<CloudDownloadOutlined />}
                            onClick={() => window.open(RELEASE_URL, "_blank", "noopener,noreferrer")}
                            className={styles.updateBtn}
                            block
                          >
                            前往 GitHub 下载新版 APK
                          </Button>
                        ) : (
                          <Button
                            type="primary"
                            icon={<CloudDownloadOutlined />}
                            loading={gitBusy}
                            onClick={() => startSelfUpdate(true)}
                            className={styles.updateBtn}
                            block
                          >
                            {gitStatus?.dirty ? "强制更新（stash 本地改动）" : "从 GitHub 更新代码"}
                          </Button>
                        )
                      )}
                    </div>

                  </div>
                ) : (
                  <Text type="secondary">版本信息加载失败</Text>
                )}
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title="数据状态"
                size="small"
                className={styles.infoCard}
                extra={<SyncOutlined onClick={handleRefresh} className={styles.refreshIcon} />}
              >
                <DataFreshnessIndicator ref={dataFreshnessRef} showActions={false} />
              </Card>

              <Card title="创建者" size="small" className={styles.infoCard}>
                <div className={styles.creatorInfo}>
                  <img src={`${import.meta.env.BASE_URL}icons/陈元昊肖像.svg`} alt="创建者" className={styles.creatorAvatar} />
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

      <Modal
        title="代码更新进度"
        open={updateModalOpen}
        onCancel={() => {
          if (updateResult?.status === "success" && updateTaskType !== "full") {
            window.location.reload();
          } else {
            setUpdateModalOpen(false);
            setUpdateTaskId(null);
            setUpdateTaskType(null);
          }
        }}
        footer={[
          updateResult?.status === "success" ? (
            updateTaskType === "full" ? (
              <Button key="close-full" type="primary" onClick={() => { setUpdateModalOpen(false); setUpdateTaskType(null); }}>
                关闭（点击「重启应用生效」应用更新）
              </Button>
            ) : (
              <Button key="reload" type="primary" onClick={() => window.location.reload()}>
                刷新页面
              </Button>
            )
          ) : updateResult ? (
            <Button key="close" onClick={() => { setUpdateModalOpen(false); setUpdateTaskId(null); setUpdateTaskType(null); }}>
              关闭
            </Button>
          ) : (
            <Button key="cancel" onClick={() => setUpdateModalOpen(false)}>
              隐藏（后台继续）
            </Button>
          ),
        ]}
        width={560}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Progress percent={updateProgress} status={updateResult?.status === "failed" ? "exception" : updateResult?.status === "success" ? "success" : "active"} />
          <Text>{updateStage || (gitBusy ? "正在执行..." : "等待中...")}</Text>
          {gitStatus?.available && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              本地 v{gitStatus.local_version} @ {gitStatus.local_sha?.slice(0, 7)}
              {gitStatus.dirty ? " · 工作区有未提交改动" : ""}
            </Text>
          )}
          {updateLog.length > 0 && (
            <pre style={{ maxHeight: 200, overflow: "auto", background: "var(--bg-secondary, #f5f5f5)", padding: 8, fontSize: 11, borderRadius: 4 }}>
              {updateLog.join("\n")}
            </pre>
          )}
          {updateResult?.status === "success" && (
            updateTaskType === "full" ? (
              <Text type="success">
                ✅ 完整更新包已就绪（v{remoteVersion || "新版本"}），关闭后点击「重启应用生效」应用更新。
              </Text>
            ) : (
              <Text type="success">
                ✅ 更新成功：v{updateResult.before_version} → v{updateResult.after_version}
              </Text>
            )
          )}
          {updateResult?.status === "failed" && (
            <Text type="danger">
              ❌ 更新失败：{updateResult.message}
            </Text>
          )}
          {updateResult?.status === "completed_with_conflicts" && (
            <Text type="warning">
              ⚠️ 代码已更新，但本地改动与远端冲突：{updateResult.message}
            </Text>
          )}
        </Space>
      </Modal>

    </>
  );
};

export default HelpModal;
