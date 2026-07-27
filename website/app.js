/**
 * 省心投 BI 官网交互
 * - 导航栏滚动背景
 * - 元素进入视口时的 reveal 动效
 * - Hero 元素页面加载后自动触发
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
});
