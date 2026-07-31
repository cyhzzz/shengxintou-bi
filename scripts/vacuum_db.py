"""
SQLite 数据库瘦身脚本（v3.7.0+）

必要性：
- default PRAGMA auto_vacuum=0 → DELETE / REPLACE 后的死页永远不回收
- journal_mode=delete → transaction 提交后不清理 -journal
- 频繁导入（特别是 conversion_appmarket / vendor_daily）每次都会留下数 MB 碎片

执行时机：
- 启动时检查 db_size > 80MB → 后台跑一次 VACUUM
- 或手动：python scripts/vacuum_db.py

注意：VACUUM 会重建整个数据库，期间会短暂锁库（约 1-3s），
建议在低峰期或导入前执行。
"""
import sqlite3
import os
import time

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'shengxintou.db')


def vacuum():
    if not os.path.exists(DB_PATH):
        print(f'数据库不存在: {DB_PATH}')
        return

    before = os.path.getsize(DB_PATH) / 1024 / 1024
    print(f'清理前: {before:.2f} MB')

    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()

        # 1. 关闭 WAL（如果开了，先 checkpoint flush）
        cur.execute('PRAGMA wal_checkpoint(TRUNCATE);')
        cur.execute('PRAGMA journal_mode = delete;')

        # 2. 开启 auto_vacuum=INCREMENTAL（必须在 VACUUM 之前设）
        #    SQLite 限制：auto_vacuum 改动需要 VACUUM 一次才能让 freelist 真正收缩
        #    INCREMENTAL 模式：死页立即加入 freelist，但需要 incremental_vacuum(N) 主动回收
        #    配合 import 流程的 incremental_vacuum(1000) 即可让增长可控
        cur.execute('PRAGMA auto_vacuum = INCREMENTAL;')

        # 3. 重写整个数据库（一次性回收所有历史碎片）
        t0 = time.time()
        cur.execute('VACUUM;')
        cost = time.time() - t0

        # 4. 重新分析（让查询计划器拿到最新统计）
        cur.execute('ANALYZE;')
        conn.commit()

        # 5. 触发 incremental_vacuum(全量) 把 freelist 清零
        cur.execute('PRAGMA incremental_vacuum;')
        conn.commit()

        # 6. 打印新状态
        fl = cur.execute('PRAGMA freelist_count').fetchone()[0]
        av = cur.execute('PRAGMA auto_vacuum').fetchone()[0]
    finally:
        conn.close()

    after = os.path.getsize(DB_PATH) / 1024 / 1024
    saved = before - after
    print(f'清理后: {after:.2f} MB')
    print(f'回收: {saved:.2f} MB (耗时 {cost:.1f}s)')
    print(f'auto_vacuum: {av} (2=INCREMENTAL，下次自动回收)')
    print(f'freelist_count: {fl} 页')


if __name__ == '__main__':
    vacuum()
