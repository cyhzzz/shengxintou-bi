import { useLocation, useOutlet } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import styles from './AnimatedOutlet.module.scss';

/**
 * 页面路由过渡包装器（v3.2.5）
 * - 与 react-router 的 useOutlet / useLocation 集成，自动按 pathname 触发动画
 * - 配合外层 LazyMotion + domAnimation 使用，按需加载动效运行时，减少主包体积
 */
export default function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    // v3.2.5：动效层次梳理——AnimatedOutlet 只做纯淡入（去掉 y 位移），避免与 FadeInSection 的 translateY 叠加
    // 页面级（0.5s 纯淡入） → 容器级（FadeInSection 0.8s 淡入+上浮） → 组件级（ECharts 1.5s 线/柱绘制） → 细节级（hover/focus）
    <AnimatePresence mode="popLayout">
      <m.div
        key={location.pathname}
        className={styles.pageMotion}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {outlet}
      </m.div>
    </AnimatePresence>
  );
}
