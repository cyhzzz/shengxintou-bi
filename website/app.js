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
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
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

  // —— v3.6.2：iOS 用户访问官网时高亮 PWA 入口 + 显示引导提示 ——
  // v3.6.2：首屏「下载最新版」和右上角「下载」按钮也自适应 iOS → 指向 PWA
  const iosBtn = document.getElementById('iosPwaBtn');
  const iosHint = document.getElementById('iosHint');
  const heroBtn = document.getElementById('heroDownloadBtn');
  const navBtn = document.getElementById('navDownloadBtn');

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const PWA_URL = '/shengxintou-bi/app/';

  if (isIOS) {
    // iOS 用户：所有下载入口统一指向 PWA
    if (iosBtn && iosHint) {
      iosHint.style.display = 'block';
      iosBtn.style.background = 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)';
      iosBtn.style.boxShadow = '0 8px 24px rgba(22, 119, 255, 0.4)';
    }
    if (heroBtn) {
      heroBtn.href = PWA_URL;
      heroBtn.removeAttribute('target');
      heroBtn.innerHTML = heroBtn.innerHTML.replace('下载最新版', '立即使用 iOS 网页版');
    }
    if (navBtn) {
      navBtn.href = PWA_URL;
      navBtn.removeAttribute('target');
      navBtn.textContent = '打开 iOS 版';
    }
  } else if (isAndroid) {
    // Android 用户：iOS 按钮换成 APK 下载提示
    if (iosBtn) {
      iosBtn.textContent = 'Android 用户请点上方 APK 下载';
      iosBtn.style.opacity = '0.5';
      iosBtn.href = 'https://github.com/cyhzzz/shengxintou-bi/releases/latest';
    }
  }
});
