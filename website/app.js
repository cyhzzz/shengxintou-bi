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
});
