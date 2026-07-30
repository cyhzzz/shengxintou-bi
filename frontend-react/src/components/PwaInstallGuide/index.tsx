/**
 * PWA 首次使用安装引导（v3.6.4）
 *
 * 触发条件（全部满足才显示）：
 *   1. 构建模式为 'pwa'（isPwaClient() === true）
 *   2. 当前未以 standalone 模式运行（用户在浏览器标签页中访问 PWA URL，还没添加到主屏幕）
 *   3. localStorage 未标记 'pwa_install_guide_dismissed'
 *
 * 分平台引导：
 *   - Android Chrome：监听 beforeinstallprompt，提供「添加到主屏幕」按钮触发原生安装弹窗
 *   - iOS Safari：显示「分享 → 添加到主屏幕」图文步骤（iOS 不支持 beforeinstallprompt）
 *   - 桌面 Chrome：提供「安装应用」按钮
 *
 * 用户操作后：
 *   - 点击「添加到主屏幕」成功 → 标记 dismissed，提示用户从主屏幕打开
 *   - 点击「稍后再说」→ 关闭 Modal，但不标记 dismissed（下次访问再提示）
 *   - 点击「不再提示」→ 标记 dismissed，不再显示
 */
import { useEffect, useState } from 'react';
import { Modal, Button, Steps, Typography, App as AntApp } from 'antd';
import { MobileOutlined, ShareAltOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { isPwaClient } from '@/utils/isDesktop';

const { Text, Paragraph } = Typography;

const DISMISS_KEY = 'pwa_install_guide_dismissed';
const INSTALL_SHOWN_KEY = 'pwa_install_prompt_shown';

// beforeinstallprompt 事件类型（非标准 API，TS 无声明）
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 检测是否已以 standalone 模式运行（PWA 已安装到主屏幕）
const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  } catch { /* matchMedia 不可用 */ }
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
  return false;
};

// 检测 iOS Safari（不支持 beforeinstallprompt，需手动引导）
const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ 的 Safari UA 与 macOS 相同，需额外检测 Mac + 触屏
  const isIPad = /Macintosh/.test(ua) && 'ontouchend' in document;
  return /iPhone|iPad|iPod/.test(ua) || isIPad;
};

// 检测 Android（支持 beforeinstallprompt）
const isAndroid = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

export const PwaInstallGuide: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const { message: antdMessage } = AntApp.useApp();

  // 监听 beforeinstallprompt（Android Chrome / 桌面 Chrome）
  useEffect(() => {
    if (!isPwaClient() || isStandalone()) return;

    // 已 dismissed 则不再显示
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const handler = (e: Event) => {
      e.preventDefault(); // 阻止 Chrome 自动弹出迷你横幅，改由我们引导
      const promptEvent = e as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      // 已展示过 beforeinstallprompt 才弹 Modal（避免在无安装能力时打扰用户）
      if (!sessionStorage.getItem(INSTALL_SHOWN_KEY)) {
        sessionStorage.setItem(INSTALL_SHOWN_KEY, '1');
        setVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS 不触发 beforeinstallprompt，延迟 1.5s 后主动弹一次引导
    // （等首屏渲染完成，避免与 chunk 加载竞争）
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIOS() && !sessionStorage.getItem(INSTALL_SHOWN_KEY)) {
      iosTimer = setTimeout(() => {
        sessionStorage.setItem(INSTALL_SHOWN_KEY, '1');
        setVisible(true);
      }, 1500);
    }

    // 监听 appinstalled 事件（安装成功后关闭引导）
    const installedHandler = () => {
      setInstalled(true);
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, '1');
      antdMessage.success('已添加到主屏幕，下次可从桌面图标直接打开');
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [antdMessage]);

  // 触发原生安装弹窗（Android / 桌面 Chrome）
  const handleInstall = async () => {
    if (!installPrompt) {
      antdMessage.info('当前浏览器不支持一键安装，请通过浏览器菜单「添加到主屏幕」手动安装');
      return;
    }
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        localStorage.setItem(DISMISS_KEY, '1');
        setVisible(false);
        antdMessage.success('安装成功，下次可从桌面图标直接打开');
      }
      // 用户取消则保持 Modal 开着，不标记 dismissed
    } catch (err) {
      antdMessage.error('安装失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setInstalling(false);
      setInstallPrompt(null); // Chrome 规定 prompt 只能调用一次
    }
  };

  // 稍后再说：关闭但不标记 dismissed（下次访问再提示）
  const handleLater = () => setVisible(false);

  // 不再提示：标记 dismissed
  const handleNever = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  const ios = isIOS();
  const android = isAndroid();

  return (
    <Modal
      open={visible}
      closable={false}
      maskClosable={false}
      width={420}
      centered
      footer={[
        installed ? (
          <Button key="done" type="primary" onClick={() => setVisible(false)}>
            完成
          </Button>
        ) : (
          <>
            <Button key="never" type="text" onClick={handleNever}>
              不再提示
            </Button>
            <Button key="later" onClick={handleLater}>
              稍后再说
            </Button>
            {(android || installPrompt) && (
              <Button key="install" type="primary" loading={installing} onClick={handleInstall}>
                添加到主屏幕
              </Button>
            )}
          </>
        ),
      ]}
    >
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <MobileOutlined style={{ fontSize: 40, color: '#1890ff', marginBottom: 12 }} />
        <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>
          添加到主屏幕，获得原生 App 体验
        </h3>
        <Paragraph type="secondary" style={{ fontSize: 13, margin: '0 0 16px' }}>
          省心投 BI 支持以 PWA 形式安装到桌面，离线可用、全屏沉浸、无浏览器地址栏。
        </Paragraph>
      </div>

      {ios ? (
        <Steps
          direction="vertical"
          size="small"
          current={-1}
          items={[
            {
              title: '点击底部「分享」按钮',
              description: '在 Safari 工具栏中找到',
              icon: <ShareAltOutlined />,
            },
            {
              title: '选择「添加到主屏幕」',
              description: '在弹出菜单中向下滑动找到',
              icon: <PlusOutlined />,
            },
            {
              title: '点击「添加」确认',
              description: '桌面将出现省心投图标，点击即可全屏启动',
              icon: <CheckCircleOutlined />,
            },
          ]}
        />
      ) : android || installPrompt ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            点击下方「添加到主屏幕」按钮，浏览器将弹出安装确认框。
            安装后桌面会出现省心投图标，点击即可全屏启动，无需再通过浏览器地址栏访问。
          </Text>
        </div>
      ) : (
        <Steps
          direction="vertical"
          size="small"
          current={-1}
          items={[
            {
              title: '点击浏览器地址栏右侧菜单',
              description: 'Chrome 右上角 ⋮ 图标',
            },
            {
              title: '选择「添加到主屏幕」或「安装应用」',
              description: '不同浏览器文案略有差异',
              icon: <PlusOutlined />,
            },
            {
              title: '确认安装',
              description: '桌面将出现省心投图标',
              icon: <CheckCircleOutlined />,
            },
          ]}
        />
      )}
    </Modal>
  );
};

export default PwaInstallGuide;
