# -*- coding: utf-8 -*-
"""
简单验证SQLite数据库WAL模式
"""

import os
import sqlite3

def verify_wal_mode():
    """验证SQLite数据库WAL模式"""
    print("=" * 60)
    print("简单验证SQLite数据库WAL模式")
    print("=" * 60)
    
    # 数据库文件路径
    database_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'database', 'shengxintou.db')
    
    if not os.path.exists(database_path):
        print(f"错误：数据库文件不存在: {database_path}")
        return False
    
    print(f"数据库文件: {database_path}")
    print()
    
    try:
        # 直接连接SQLite数据库
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()
        
        # 检查WAL模式
        cursor.execute("PRAGMA journal_mode")
        journal_mode = cursor.fetchone()[0]
        print(f"1. Journal Mode: {journal_mode}")
        print(f"2. WAL模式已启用: {journal_mode == 'wal'}")
        print()
        
        # 检查其他优化参数
        cursor.execute("PRAGMA cache_size")
        cache_size = cursor.fetchone()[0]
        print(f"3. 缓存大小: {cache_size} pages")
        print(f"4. 大约内存: {abs(cache_size) * 4 / 1024:.1f} MB")
        print()
        
        cursor.execute("PRAGMA synchronous")
        synchronous = cursor.fetchone()[0]
        print(f"5. 同步模式: {synchronous}")
        
        cursor.execute("PRAGMA temp_store")
        temp_store = cursor.fetchone()[0]
        print(f"6. 临时存储: {temp_store} (2=内存)")
        
        cursor.execute("PRAGMA busy_timeout")
        busy_timeout = cursor.fetchone()[0]
        print(f"7. 繁忙超时: {busy_timeout} ms")
        print()
        
        cursor.close()
        conn.close()
        
        print("=" * 60)
        print("验证完成")
        print("=" * 60)
        
        return journal_mode == 'wal'
        
    except Exception as e:
        print(f"错误：{e}")
        return False

if __name__ == "__main__":
    success = verify_wal_mode()
    exit(0 if success else 1)
