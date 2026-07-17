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
    <AnimatePresence mode="wait">
      <m.div
        key={location.pathname}
        className={styles.pageMotion}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      >
        {outlet}
      </m.div>
    </AnimatePresence>
  );
}
