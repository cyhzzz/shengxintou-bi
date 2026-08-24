# -*- coding: utf-8 -*-
"""WebDAV 逐表同步核心工具测试

覆盖 util（不触碰网络/WebDAV）：
- 单表导出 -> 合并入库 的往返一致性
- 版本信号：watermark 优先；事实表无 watermark 时用 MAX(业务日期) 兜底
- 维表无 watermark：本机有数据返回初始化版本 '0'（可上传建端），空表返回 None
- 整库快照兜底：download_latest_snapshot + 从整库快照合并单表

运行：
  python -m unittest tests.api.test_table_sync -v
"""
import os
import sys
import unittest
import tempfile
import shutil
from unittest import mock

from sqlalchemy import create_engine

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.utils import table_sync as ts  # noqa: E402


def _build_source(db_path):
    """构造含一张事实表 + 一张维表 的源 SQLite（模拟一份整库快照）。返回 (engine, 期望行集)。"""
    engine = create_engine(f'sqlite:///{db_path}')
    conn = engine.raw_connection()
    cur = conn.cursor()
    cur.execute('CREATE TABLE fact_conv_content ("线索日期" TEXT, "设备号" TEXT, "计划名称" TEXT)')
    rows = [
        ('2026-08-01', 'A1', '计划一'),
        ('2026-08-02', 'A2', '计划一'),
        ('2026-08-03', 'A3', '计划二'),
    ]
    cur.executemany('INSERT INTO fact_conv_content VALUES (?,?,?)', rows)
    cur.execute('CREATE TABLE dim_account ("全称" TEXT, "简称" TEXT)')
    cur.executemany('INSERT INTO dim_account VALUES (?,?)', [('华泰证券', '华泰'), ('中信证券', '中信')])
    conn.commit()
    cur.close()
    conn.close()
    return engine, rows


class _FakeClient:
    """模拟 WebDAVBackupClient.list_backups / download_backup，指向本地快照文件。"""

    def __init__(self, snapshot_path, filename='backup_20260824_120000.db'):
        self.snapshot_path = snapshot_path
        self.filename = filename

    def list_backups(self):
        return [{'filename': self.filename, 'created': '2026-08-24 12:00:00'}]

    def download_backup(self, filename, local_db_path):
        shutil.copyfile(self.snapshot_path, local_db_path)


class TableSyncUtilTest(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='table_sync_test_')
        self.src_db = os.path.join(self.tmp, 'src.db')

    def tearDown(self):
        # 复位可能写入的 watermark 文件
        try:
            if os.path.exists(ts._watermark_path()):
                os.remove(ts._watermark_path())
        except Exception:
            pass

    @mock.patch.object(ts, '_watermark_path')
    def test_export_merge_roundtrip(self, mock_wm_path):
        # watermark 指向临时文件，避免污染仓库
        mock_wm_path.return_value = os.path.join(self.tmp, 'wm.json')
        engine, expected = _build_source(self.src_db)

        # 1. 导出单表文件
        single_file = os.path.join(self.tmp, 'fact_conv_content.db')
        n = ts.export_table_to_sqlite_file(engine, 'fact_conv_content', single_file)
        self.assertEqual(n, 3)
        self.assertTrue(os.path.exists(single_file))

        # 2. 合并进目标库
        dst_db = os.path.join(self.tmp, 'dst.db')
        dst_engine = create_engine(f'sqlite:///{dst_db}')
        merged = ts.merge_sqlite_table_into(dst_engine, 'fact_conv_content', single_file, dst_is_pg=False)
        self.assertEqual(merged, 3)

        with dst_engine.connect() as conn:
            got = conn.execute(
                __import__('sqlalchemy').text(
                    'SELECT "线索日期","设备号","计划名称" FROM fact_conv_content ORDER BY "线索日期"')
            ).fetchall()
        self.assertEqual([tuple(r) for r in got], [tuple(r) for r in expected])

    @mock.patch.object(ts, '_watermark_path')
    def test_version_watermark_priority_and_fact_fallback(self, mock_wm_path):
        mock_wm_path.return_value = os.path.join(self.tmp, 'wm.json')
        engine, _ = _build_source(self.src_db)

        # 未写 watermark：事实表走 MAX(业务日期) 兜底
        version, rows = ts.compute_table_local(engine, 'fact_conv_content')
        self.assertEqual(version, '2026-08-03')
        self.assertEqual(rows, 3)

        # 写了 watermark：优先返回 watermark 时间戳
        ts.set_table_watermark('fact_conv_content', '20260810_090000')
        version2, _ = ts.compute_table_local(engine, 'fact_conv_content')
        self.assertEqual(version2, '20260810_090000')

    @mock.patch.object(ts, '_watermark_path')
    def test_dim_version_init_without_watermark(self, mock_wm_path):
        """维表无 watermark：本机有数据返回初始化版本 '0'（可上传建端），空表返回 None。"""
        mock_wm_path.return_value = os.path.join(self.tmp, 'wm.json')
        engine, _ = _build_source(self.src_db)
        # 维表无 watermark 但本机有数据 -> 返回初始化版本 '0'（可上传建端）
        version, rows = ts.compute_table_local(engine, 'dim_account')
        self.assertEqual(version, ts._INIT_DIM_VERSION)
        self.assertEqual(rows, 2)
        # 有 watermark -> 优先返回 watermark（比 '0' 新，可覆盖）
        ts.set_table_watermark('dim_account', '20260810_090000')
        version2, _ = ts.compute_table_local(engine, 'dim_account')
        self.assertEqual(version2, '20260810_090000')
        # 空表（无数据）-> None（不参与上传）
        engine2 = create_engine(f'sqlite:///{os.path.join(self.tmp, "empty.db")}')
        conn = engine2.raw_connection()
        conn.cursor().execute('CREATE TABLE dim_ad_plan_class ("分类" TEXT)')
        conn.commit()
        conn.cursor().close()
        conn.close()
        v3, r3 = ts.compute_table_local(engine2, 'dim_ad_plan_class')
        self.assertIsNone(v3)
        self.assertEqual(r3, 0)

    def test_snapshot_fallback_download_latest_and_merge(self):
        """老同事整库快照兜底：能拉下最新快照，并从中抽取单表合并入库。"""
        engine, _ = _build_source(self.src_db)  # src_db 即一份整库快照
        client = _FakeClient(self.src_db)

        tmpdir = os.path.join(self.tmp, 'dl')
        os.makedirs(tmpdir, exist_ok=True)
        snapshot = ts.download_latest_snapshot(client, tmpdir)
        self.assertIsNotNone(snapshot)
        self.assertTrue(os.path.exists(snapshot))

        # 从整库快照抽取缺失的单表合并进空目标库
        dst_db = os.path.join(self.tmp, 'dst_snapshot.db')
        dst_engine = create_engine(f'sqlite:///{dst_db}')
        n = ts.merge_sqlite_table_into(dst_engine, 'fact_conv_content', snapshot, dst_is_pg=False)
        self.assertEqual(n, 3)
        with dst_engine.connect() as conn:
            rows = conn.execute(
                __import__('sqlalchemy').text(
                    'SELECT COUNT(*) FROM fact_conv_content')).fetchone()[0]
        self.assertEqual(rows, 3)

    def test_snapshot_fallback_no_backups_returns_none(self):
        """云端无整库快照时返回 None。"""
        client = _FakeClient(None)
        client.list_backups = lambda: []
        tmpdir = os.path.join(self.tmp, 'dl')
        os.makedirs(tmpdir, exist_ok=True)
        self.assertIsNone(ts.download_latest_snapshot(client, tmpdir))

    def test_snapshot_table_max_date(self):
        """从整库快照读取某表 MAX(业务日期)：事实表返回日期；维表/缺失表返回 None。"""
        _build_source(self.src_db)  # src_db 即一份整库快照
        # 事实表（有业务日期列）-> 返回快照里的最新数据日期
        d = ts.snapshot_table_max_date(self.src_db, 'fact_conv_content')
        self.assertEqual(d, '2026-08-03')
        # 维表（无业务日期列）-> None
        self.assertIsNone(ts.snapshot_table_max_date(self.src_db, 'dim_account'))
        # 快照里不存在的表 -> None
        self.assertIsNone(ts.snapshot_table_max_date(self.src_db, 'agg_vendor_daily'))

    def test_normalize_version(self):
        """版本信号归一化：三种来源均可比较（日期 / watermark / 维表初始化）。"""
        self.assertEqual(ts.normalize_version('2026-08-23'), 20260823)
        self.assertEqual(ts.normalize_version('20260824_083000'), 20260824083000)
        self.assertEqual(ts.normalize_version('0'), 0)
        self.assertIsNone(ts.normalize_version(''))
        self.assertIsNone(ts.normalize_version(None))
        # 同一天：日期(无时间) < 带时间戳的 watermark，语义正确
        self.assertLess(ts.normalize_version('2026-08-24'), ts.normalize_version('20260824_083000'))



if __name__ == '__main__':
    unittest.main()