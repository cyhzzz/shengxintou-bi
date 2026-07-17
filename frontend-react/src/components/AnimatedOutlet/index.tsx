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
    // v3.2.6：mode="popLayout" 让进入/离开同时发生，避免 wait 模式的「等退出再进入」空档，减少 perceived delay
    <AnimatePresence mode="popLayout">
      <m.div
        key={location.pathname}
        className={styles.pageMotion}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ willChange: 'transform, opacity' }}
      >
        {outlet}
      </m.div>
    </AnimatePresence>
  );
}
