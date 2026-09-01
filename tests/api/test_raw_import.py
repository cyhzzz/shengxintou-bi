# -*- coding: utf-8 -*-
"""应用市场下载链路（conversion_appmarket）导入分区替换测试

背景：源数据规则为「保留 2026-06-30 及之前历史，之后上传的文件仅含 2026-07-01 以后数据」，
导入（含全量替换开关开启时）只清空并重写 2026-07-01 及以后的数据，避免整表替换丢失历史。

本测试使用临时 SQLite DB + 临时 Excel，不触碰真实数据库。

运行：
  python -m unittest tests.api.test_raw_import -v
"""
import os
import sys
import unittest
import sqlite3
import tempfile

import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.processors.v2.raw_import import write_to_db, APPMARKET_CONV_REPLACE_FROM, VENDOR_DAILY_REPLACE_FROM  # noqa: E402

CUTOFF = APPMARKET_CONV_REPLACE_FROM  # '2026-07-01'


def _make_db(path, columns, seed):
    con = sqlite3.connect(path)
    con.execute(f'CREATE TABLE fact_conv_appmarket (id INTEGER PRIMARY KEY AUTOINCREMENT, {columns})')
    if seed:
        placeholders = ','.join('?' * len(seed[0]))
        con.executemany(f'INSERT INTO fact_conv_appmarket VALUES ({placeholders})', seed)
    con.commit()
    con.close()


def _rows(path, table='fact_conv_appmarket'):
    con = sqlite3.connect(path)
    rows = sorted(con.execute(f'SELECT 设备号, 下载日期 FROM "{table}"').fetchall())
    con.close()
    return rows


class ConversionAppmarketPartitionTest(unittest.TestCase):
    """全量替换开关（overwrite=True 默认）下：保留 <=6/30，只重写 >=7/1。"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='conv_appmarket_test_')
        self.db = os.path.join(self.tmp, 'test.db')

    def tearDown(self):
        try:
            for f in os.listdir(self.tmp):
                os.remove(os.path.join(self.tmp, f))
            os.rmdir(self.tmp)
        except OSError:
            pass

    def test_partition_replace_keeps_history(self):
        cols = '"设备号" TEXT, "下载日期" TEXT, "是否激活APP" INTEGER'
        _make_db(self.db, cols, [
            (1, 'dev-1', '2026-06-15', 1),   # 历史（保留）
            (2, 'dev-2', '2026-06-28', 0),   # 历史（保留）
            (3, 'dev-3', '2026-07-03', 1),   # >=7/1 旧数据（被替换）
            (4, 'dev-4', '2026-08-10', 1),   # >=7/1 旧数据（新文件无此条 -> 被清掉）
        ])
        xlsx = os.path.join(self.tmp, 'source.xlsx')
        pd.DataFrame({
            '设备号': ['dev-3', 'dev-5', 'dev-6'],
            '下载日期': ['2026-07-03', '2026-08-15', '2026-07-20'],
            '是否激活APP': [1, 1, 0],
        }).to_excel(xlsx, index=False)

        write_to_db('conversion_appmarket', xlsx, db_url=f'sqlite:///{self.db}')

        rows = _rows(self.db)
        expect = sorted([
            ('dev-1', '2026-06-15'),
            ('dev-2', '2026-06-28'),
            ('dev-3', '2026-07-03'),
            ('dev-5', '2026-08-15'),
            ('dev-6', '2026-07-20'),
        ])
        self.assertEqual(rows, expect)
        # dev-4（旧 7/1 后数据，新文件无）应被清除
        self.assertNotIn(('dev-4', '2026-08-10'), rows)

    def test_cutoff_is_2026_07_01(self):
        self.assertEqual(CUTOFF, '2026-07-01')


class IncrementalModeUnaffectedTest(unittest.TestCase):
    """增量模式（overwrite=False）仍按 设备号+下载日期 去重，不受分区替换影响。"""

    def test_incremental_dedup(self):
        tmp = tempfile.mkdtemp(prefix='conv_appmarket_inc_')
        try:
            db = os.path.join(tmp, 'a.db')
            _make_db(db, '"设备号" TEXT, "下载日期" TEXT', [
                (1, 'dev-1', '2026-06-15'),
                (2, 'dev-3', '2026-07-03'),
                (3, 'dev-4', '2026-08-10'),
            ])
            xlsx = os.path.join(tmp, 'a.xlsx')
            pd.DataFrame({'设备号': ['dev-3', 'dev-5'], '下载日期': ['2026-07-03', '2026-08-15']}).to_excel(xlsx, index=False)

            write_to_db('conversion_appmarket', xlsx, db_url=f'sqlite:///{db}', overwrite=False)

            rows = _rows(db)
            expect = sorted([
                ('dev-1', '2026-06-15'),
                ('dev-3', '2026-07-03'),
                ('dev-4', '2026-08-10'),
                ('dev-5', '2026-08-15'),
            ])
            self.assertEqual(rows, expect)
        finally:
            for f in os.listdir(tmp):
                os.remove(os.path.join(tmp, f))
            os.rmdir(tmp)


class OtherTypesReplaceUnaffectedTest(unittest.TestCase):
    """其他数据类型整表替换（overwrite=True）不受影响。"""

    def test_vendor_daily_full_replace(self):
        tmp = tempfile.mkdtemp(prefix='vendor_replace_')
        try:
            db = os.path.join(tmp, 'b.db')
            con = sqlite3.connect(db)
            con.execute('CREATE TABLE agg_vendor_daily (id INTEGER PRIMARY KEY AUTOINCREMENT, "日期" TEXT, "花费" FLOAT)')
            con.executemany('INSERT INTO agg_vendor_daily ("日期","花费") VALUES (?,?)', [('2026-07-01', 1.0), ('2026-07-02', 2.0)])
            con.commit()
            con.close()
            xlsx = os.path.join(tmp, 'b.xlsx')
            pd.DataFrame({'日期': ['2026-08-01'], '花费': [9.9]}).to_excel(xlsx, index=False)

            write_to_db('vendor_daily', xlsx, db_url=f'sqlite:///{db}')

            con = sqlite3.connect(db)
            n = con.execute('SELECT COUNT(*) FROM agg_vendor_daily').fetchone()[0]
            con.close()
            self.assertEqual(n, 1)
        finally:
            for f in os.listdir(tmp):
                os.remove(os.path.join(tmp, f))
            os.rmdir(tmp)


class VendorDailyPartitionTest(unittest.TestCase):
    """厂商广告投放分析（vendor_daily）：智能分区替换。

    - 新文件 min(日期) >= 7/1（滚动增量）：保留 6/30 及之前历史，只重写 7/1 以后
    - 新文件含 7/1 之前数据（全量文件）：整表替换
    """

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='vendor_part_')
        self.db = os.path.join(self.tmp, 'v.db')

    def tearDown(self):
        try:
            for f in os.listdir(self.tmp):
                os.remove(os.path.join(self.tmp, f))
            os.rmdir(self.tmp)
        except OSError:
            pass

    def _seed(self, rows):
        con = sqlite3.connect(self.db)
        con.execute('CREATE TABLE agg_vendor_daily (id INTEGER PRIMARY KEY AUTOINCREMENT, "日期" TEXT, "花费" FLOAT)')
        con.executemany('INSERT INTO agg_vendor_daily ("日期","花费") VALUES (?,?)', rows)
        con.commit()
        con.close()

    def _count(self):
        con = sqlite3.connect(self.db)
        n = con.execute('SELECT COUNT(*) FROM agg_vendor_daily').fetchone()[0]
        con.close()
        return n

    def test_partition_keeps_june_history(self):
        # 历史：6/15 应保留；7/3、8/10 属 >=7/1 旧数据应被新文件覆盖/清除
        self._seed([('2026-06-15', 1.0), ('2026-07-03', 2.0), ('2026-08-10', 3.0)])
        xlsx = os.path.join(self.tmp, 'inc.xlsx')
        pd.DataFrame({
            '日期': ['2026-07-03', '2026-08-15', '2026-07-20'],
            '花费': [5.0, 6.0, 7.0],
        }).to_excel(xlsx, index=False)

        write_to_db('vendor_daily', xlsx, db_url=f'sqlite:///{self.db}')

        con = sqlite3.connect(self.db)
        dates = sorted(r[0] for r in con.execute('SELECT "日期" FROM agg_vendor_daily').fetchall())
        con.close()
        # 6/15 历史保留；7/3 被新文件覆盖保留；8/10 旧数据（新文件无）被清除；新增 8/15、7/20
        self.assertEqual(dates, ['2026-06-15', '2026-07-03', '2026-07-20', '2026-08-15'])
        self.assertEqual(self._count(), 4)

    def test_full_file_replaces_everything(self):
        # 历史含 6/15、7/3；新文件含 5/01（< 7/1，判定为全量文件）→ 整表替换
        self._seed([('2026-06-15', 1.0), ('2026-07-03', 2.0)])
        xlsx = os.path.join(self.tmp, 'full.xlsx')
        pd.DataFrame({
            '日期': ['2026-05-01', '2026-07-10'],
            '花费': [9.0, 8.0],
        }).to_excel(xlsx, index=False)

        write_to_db('vendor_daily', xlsx, db_url=f'sqlite:///{self.db}')

        con = sqlite3.connect(self.db)
        dates = sorted(r[0] for r in con.execute('SELECT "日期" FROM agg_vendor_daily').fetchall())
        con.close()
        self.assertEqual(dates, ['2026-05-01', '2026-07-10'])
        self.assertEqual(self._count(), 2)

    def test_cutoff_is_2026_07_01(self):
        self.assertEqual(VENDOR_DAILY_REPLACE_FROM, '2026-07-01')


class AppmarketPeriodReplaceTest(unittest.TestCase):
    """应用市场下载链路区间拆分（h1/q3/q4）：只清空并重写指定区间，不影响其它月份。"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='conv_appmarket_period_')
        self.db = os.path.join(self.tmp, 'p.db')

    def tearDown(self):
        try:
            for f in os.listdir(self.tmp):
                os.remove(os.path.join(self.tmp, f))
            os.rmdir(self.tmp)
        except OSError:
            pass

    def _seed(self):
        con = sqlite3.connect(self.db)
        con.execute('CREATE TABLE fact_conv_appmarket (id INTEGER PRIMARY KEY AUTOINCREMENT, "设备号" TEXT, "下载日期" TEXT, "是否激活APP" INTEGER)')
        con.executemany(
            'INSERT INTO fact_conv_appmarket ("设备号","下载日期","是否激活APP") VALUES (?,?,?)',
            [
                ('h1-a', '2026-03-15', 1),   # H1 旧数据
                ('q3-a', '2026-07-15', 1),   # Q3 旧数据
                ('q4-a', '2026-11-15', 1),   # Q4 旧数据
                ('old-1', '2025-12-31', 1),  # 跨年历史（应始终保留）
            ],
        )
        con.commit()
        con.close()

    def _rows(self):
        con = sqlite3.connect(self.db)
        rows = sorted(con.execute('SELECT 设备号, 下载日期 FROM "fact_conv_appmarket"').fetchall())
        con.close()
        return rows

    def test_q3_only_replaces_q3(self):
        self._seed()
        xlsx = os.path.join(self.tmp, 'q3.xlsx')
        pd.DataFrame({
            '设备号': ['q3-b', 'q3-c'],
            '下载日期': ['2026-08-01', '2026-09-10'],
            '是否激活APP': [1, 0],
        }).to_excel(xlsx, index=False)

        write_to_db('conversion_appmarket', xlsx, db_url=f'sqlite:///{self.db}',
                    period=('2026-07-01', '2026-09-30'))

        rows = self._rows()
        # Q3 旧数据被替换；H1、Q4、跨年历史均保留
        self.assertIn(('h1-a', '2026-03-15'), rows)
        self.assertIn(('q4-a', '2026-11-15'), rows)
        self.assertIn(('old-1', '2025-12-31'), rows)
        self.assertNotIn(('q3-a', '2026-07-15'), rows)
        self.assertIn(('q3-b', '2026-08-01'), rows)
        self.assertIn(('q3-c', '2026-09-10'), rows)

    def test_h1_q4_independent(self):
        self._seed()
        # 上传 H1 区间文件
        xlsx_h1 = os.path.join(self.tmp, 'h1.xlsx')
        pd.DataFrame({'设备号': ['h1-b'], '下载日期': ['2026-05-20'], '是否激活APP': [1]}).to_excel(xlsx_h1, index=False)
        write_to_db('conversion_appmarket', xlsx_h1, db_url=f'sqlite:///{self.db}',
                    period=('2026-01-01', '2026-06-30'))

        rows = self._rows()
        self.assertNotIn(('h1-a', '2026-03-15'), rows)  # H1 旧被替换
        self.assertIn(('h1-b', '2026-05-20'), rows)     # H1 新
        self.assertIn(('q3-a', '2026-07-15'), rows)      # Q3 未动
        self.assertIn(('q4-a', '2026-11-15'), rows)      # Q4 未动
        self.assertIn(('old-1', '2025-12-31'), rows)     # 历史保留


if __name__ == '__main__':
    unittest.main()
