/**
 * 省心投 BI 官网交互
 * - 导航栏滚动背景
 * - 元素进入视口时的 reveal 动效
 * - Hero 元素页面加载后自动触发
 * - Hero 截图卡片入场 + 鼠标视差跟随（借鉴 video-shotcraft 的 graze-face-tour 思路）
 */

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  const reveals = document.querySelectorAll('.reveal');

  // —— 主题切换 ——
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('sx-theme', next);
      } catch (e) {
        // localStorage 不可用时仅本次会话生效
      }
    });
  }

  // 导航栏滚动效果
  function updateHeader() {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  // Reveal 观察器
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -60px 0px',
    }
  );

  reveals.forEach((el) => revealObserver.observe(el));

  // Showcase 卡片单独监听：用于触发入场扫光
  const showcaseCards = document.querySelectorAll('.showcase-card');
  const showcaseObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          showcaseObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );
  showcaseCards.forEach((el) => showcaseObserver.observe(el));

  // —— Hero 粒子尘埃：随机生成 18 个 dust 点 ——
  const dustField = document.querySelector('.dust-field');
  if (dustField) {
    const colors = ['#1890ff', '#c96b4a', '#c9a227', '#7a9e7e'];
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('span');
      d.className = 'dust';
      const x = Math.random() * 100;
      const y = 60 + Math.random() * 40; // 从下方往上飘
      const tx = (Math.random() - 0.5) * 120;
      const ty = -80 - Math.random() * 160;
      const dur = 7 + Math.random() * 6;
      const delay = Math.random() * 6;
      const size = 2 + Math.random() * 3;
      d.style.left = `${x}%`;
      d.style.top = `${y}%`;
      d.style.width = `${size}px`;
      d.style.height = `${size}px`;
      d.style.color = colors[i % colors.length];
      d.style.background = colors[i % colors.length];
      d.style.setProperty('--tx', `${tx}px`);
      d.style.setProperty('--ty', `${ty}px`);
      d.style.setProperty('--dur', `${dur}s`);
      d.style.setProperty('--delay', `${delay}s`);
      dustField.appendChild(d);
    }
  }

  // Hero 元素在页面加载后短暂延迟即显示
  const heroReveals = document.querySelectorAll('.hero .reveal');
  heroReveals.forEach((el, index) => {
    setTimeout(() => {
      el.classList.add('visible');
    }, 120 + index * 120);
  });

  // —— Hero 标题拆字动效（Emil BlurText 思路，CSS-only + JS 触发 stagger）——
  // 把每个 [data-split-text] 内的字符包成 <span class="char">，
  // 空格字符不参与 stagger、不显示动画（保持视觉间距即可）。
  // 0.5 倍速：stagger 28ms → 56ms，持续 360ms → 720ms
  // 关键：title-italic 内的字符需要单独继承渐变（background-clip: text 是元素级，
  //       子元素 inline-block 默认拿不到），否则「变成」会变透明。
  function splitHeroText() {
    const words = document.querySelectorAll('[data-split-text]');
    let globalIndex = 0;
    words.forEach((word) => {
      const isGradient = word.classList.contains('title-italic');
      const original = word.textContent;
      const chars = Array.from(original);
      word.textContent = '';
      chars.forEach((ch) => {
        const span = document.createElement('span');
        if (ch === ' ') {
          span.className = 'char char-space';
          span.innerHTML = '&nbsp;';
        } else {
          span.className = 'char' + (isGradient ? ' char-gradient' : '');
          span.style.setProperty('--char-delay', `${globalIndex * 56}ms`);
          span.textContent = ch;
          globalIndex += 1;
        }
        word.appendChild(span);
      });
    });
  }
  splitHeroText();

  // 当 hero title reveal 完成后再触发拆字动画（与 hero reveal 时序对齐）
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    setTimeout(() => {
      heroTitle.classList.add('split-started');
    }, 280);
  }

  // —— Hero 截图卡片入场 + 鼠标视差跟随 ——
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual) {
    // 等文字 reveal 起来后，再让截图卡片入场
    setTimeout(() => {
      heroVisual.classList.add('entered');
    }, 360);

    // 鼠标视差：归一化到 -0.5 ~ 0.5
    let rafId = null;
    let pendingMx = 0;
    let pendingMy = 0;

    const applyParallax = () => {
      heroVisual.style.setProperty('--mx', pendingMx.toFixed(3));
      heroVisual.style.setProperty('--my', pendingMy.toFixed(3));
      rafId = null;
    };

    heroVisual.addEventListener('mousemove', (e) => {
      const rect = heroVisual.getBoundingClientRect();
      pendingMx = (e.clientX - rect.left) / rect.width - 0.5;
      pendingMy = (e.clientY - rect.top) / rect.height - 0.5;
      if (rafId === null) {
        rafId = requestAnimationFrame(applyParallax);
      }
    });

    heroVisual.addEventListener('mouseleave', () => {
      pendingMx = 0;
      pendingMy = 0;
      if (rafId === null) {
        rafId = requestAnimationFrame(applyParallax);
      }
    });

    // 触摸设备：轻量陀螺仪视差（可选，不强制）
    if (window.DeviceOrientationEvent) {
      window.addEventListener(
        'deviceorientation',
        (e) => {
          if (e.beta === null || e.gamma === null) return;
          pendingMx = Math.max(-0.5, Math.min(0.5, e.gamma / 45));
          pendingMy = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90));
          if (rafId === null) {
            rafId = requestAnimationFrame(applyParallax);
          }
        },
        { passive: true }
      );
    }
  }

  // —— iOS 用户访问官网时高亮 PWA 入口 ——
  // 首屏「下载最新版」和右上角「下载」按钮也自适应 iOS → 指向 PWA
  // Windows/Android 按钮直接触发 release 最新 asset 下载，不再跳 release 页面
  // 右上角改成下拉菜单，三端选项都可用
  const iosBtn = document.getElementById('iosPwaBtn');
  const heroBtn = document.getElementById('heroDownloadBtn');
  const navBtn = document.getElementById('navDownloadBtn');
  const navDropdown = document.getElementById('navDropdown');
  const navDownload = document.getElementById('navDownload');

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Windows/.test(ua);
  const PWA_URL = '/shengxintou-bi/app/';

  // —— 平台优先级：决定首屏「下载最新版」按钮的目标平台 ——
  // iOS → PWA；Android → APK；Windows/Mac/Linux → Windows exe
  function detectPreferredPlatform() {
    if (isIOS) return 'ios';
    if (isAndroid) return 'android';
    return 'windows';
  }

  // —— 获取 GitHub 最新 release 的 asset 下载 URL ——
  // 命中扩展名（忽略大小写）后返回 browser_download_url；失败抛错
  const RELEASE_API = 'https://api.github.com/repos/cyhzzz/shengxintou-bi/releases/latest';
  let releaseCache = null;
  let releaseFetching = null;

  async function fetchLatestRelease() {
    if (releaseCache) return releaseCache;
    if (releaseFetching) return releaseFetching;
    releaseFetching = fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => {
        if (!r.ok) throw new Error(`GitHub API ${r.status}`);
        return r.json();
      })
      .then((data) => {
        releaseCache = data;
        return data;
      })
      .finally(() => {
        releaseFetching = null;
      });
    return releaseFetching;
  }

  async function resolveAssetUrl(platform) {
    const ext = platform === 'android' ? '.apk' : '.exe';
    const data = await fetchLatestRelease();
    const assets = data.assets || [];
    const match = assets.find((a) => a.name && a.name.toLowerCase().endsWith(ext));
    if (!match) {
      throw new Error(`未找到 ${ext} 资源`);
    }
    return match.browser_download_url;
  }

  // —— 触发下载：先显示 loading，再 location.href 跳转 asset URL ——
  // GitHub release asset 的 Content-Disposition 是 attachment，浏览器会直接下载而非跳转
  async function triggerDownload(btn, platform) {
    if (!btn) return;
    const labelEl = btn.querySelector('.btn-label');
    const originalText = labelEl ? labelEl.textContent : '';
    btn.setAttribute('data-loading', 'true');
    if (labelEl) labelEl.textContent = '正在获取下载链接…';
    try {
      const url = await resolveAssetUrl(platform);
      // GitHub release 下载 URL 带附件头，浏览器会触发下载而非跳转页面
      window.location.href = url;
    } catch (err) {
      console.error('[download] resolve asset failed:', err);
      // 兜底：失败时跳转到 release 页面让用户手动下载
      window.open('https://github.com/cyhzzz/shengxintou-bi/releases/latest', '_blank', 'noopener');
    } finally {
      // 2 秒后恢复按钮状态（下载已触发或失败兜底后）
      setTimeout(() => {
        btn.removeAttribute('data-loading');
        if (labelEl) labelEl.textContent = originalText;
      }, 2000);
    }
  }

  // —— 首屏「下载最新版」按钮：按平台自适应 ——
  if (heroBtn) {
    const preferred = detectPreferredPlatform();
    const heroLabel = heroBtn.querySelector('.btn-label');
    if (preferred === 'ios') {
      // iOS：按钮指向 PWA，文案改为 iOS 网页版
      heroBtn.addEventListener('click', () => {
        window.location.href = PWA_URL;
      });
      if (heroLabel) heroLabel.textContent = '立即使用 iOS 网页版';
    } else {
      // Windows / Android：点击触发对应 asset 下载
      heroBtn.dataset.platform = preferred;
      heroBtn.addEventListener('click', () => triggerDownload(heroBtn, preferred));
      if (heroLabel) {
        heroLabel.textContent = preferred === 'android' ? '下载 Android APK' : '下载 Windows 版';
      }
    }
  }

  // —— 右上角下拉菜单：点击展开/收起 ——
  function toggleDropdown(open) {
    if (!navDownload || !navDropdown || !navBtn) return;
    const shouldOpen = typeof open === 'boolean' ? open : !navDownload.classList.contains('open');
    if (shouldOpen) {
      navDownload.classList.add('open');
      navDropdown.classList.add('open');
      navDropdown.hidden = false;
      navBtn.setAttribute('aria-expanded', 'true');
    } else {
      navDownload.classList.remove('open');
      navDropdown.classList.remove('open');
      navBtn.setAttribute('aria-expanded', 'false');
      // 等动画结束后再 hidden，避免突兀
      setTimeout(() => {
        if (!navDownload.classList.contains('open')) navDropdown.hidden = true;
      }, 220);
    }
  }

  if (navBtn) {
    navBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  // 点击外部收起下拉
  document.addEventListener('click', (e) => {
    if (navDownload && !navDownload.contains(e.target)) {
      toggleDropdown(false);
    }
  });

  // ESC 收起
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleDropdown(false);
  });

  // —— 下拉菜单项点击：Windows / Android 触发下载，iOS 跳 PWA（保持 <a href>） ——
  document.querySelectorAll('.dropdown-item[data-platform]').forEach((item) => {
    item.addEventListener('click', (e) => {
      const platform = item.dataset.platform;
      toggleDropdown(false);
      if (platform === 'windows' || platform === 'android') {
        triggerDownload(item, platform);
      }
    });
  });

  // —— 底部 CTA 的 Windows / Android 按钮：触发直接下载 ——
  document.querySelectorAll('.cta-actions [data-platform]').forEach((btn) => {
    const platform = btn.dataset.platform;
    if (platform === 'windows' || platform === 'android') {
      btn.addEventListener('click', () => triggerDownload(btn, platform));
    }
  });

  // —— iOS 平台自适应：底部 iOS 按钮高亮 ——
  if (isIOS) {
    if (iosBtn) {
      iosBtn.style.background = 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)';
      iosBtn.style.boxShadow = '0 8px 24px rgba(22, 119, 255, 0.4)';
    }
  } else if (isAndroid) {
    // Android 用户：iOS 按钮换成提示（保持原有的引导文案）
    if (iosBtn) {
      const iosLabel = iosBtn.querySelector('svg + *') || iosBtn;
      iosBtn.textContent = 'Android 用户请点上方 APK 下载';
      iosBtn.style.opacity = '0.5';
      iosBtn.removeAttribute('href');
      iosBtn.style.cursor = 'default';
    }
  }
});
