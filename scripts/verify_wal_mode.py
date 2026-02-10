# -*- coding: utf-8 -*-
"""
验证SQLite数据库WAL模式是否已启用
"""

import os
import sys
import sqlite3

# 添加项目根目录到Python路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from app import app
from backend.database import db

def verify_wal_mode():
    """验证SQLite数据库WAL模式"""
    print("=" * 60)
    print("验证SQLite数据库WAL模式")
    print("=" * 60)
    
    # 方法1：直接连接数据库文件
    database_path = os.path.join(BASE_DIR, 'database', 'shengxintou.db')
    
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
        print(f"1. 直接连接检查:")
        print(f"   Journal Mode: {journal_mode}")
        print(f"   WAL模式已启用: {journal_mode == 'wal'}")
        print()
        
        # 检查其他优化参数
        cursor.execute("PRAGMA cache_size")
        cache_size = cursor.fetchone()[0]
        print(f"2. 缓存大小:")
        print(f"   Cache Size: {cache_size} pages")
        print(f"   大约内存: {abs(cache_size) * 4 / 1024:.1f} MB")
        print()
        
        cursor.execute("PRAGMA synchronous")
        synchronous = cursor.fetchone()[0]
        print(f"3. 同步模式:")
        print(f"   Synchronous: {synchronous}")
        print(f"   模式说明: {get_synchronous_description(synchronous)}")
        print()
        
        cursor.execute("PRAGMA temp_store")
        temp_store = cursor.fetchone()[0]
        print(f"4. 临时存储:")
        print(f"   Temp Store: {temp_store}")
        print(f"   存储位置: {get_temp_store_description(temp_store)}")
        print()
        
        cursor.execute("PRAGMA busy_timeout")
        busy_timeout = cursor.fetchone()[0]
        print(f"5. 繁忙超时:")
        print(f"   Busy Timeout: {busy_timeout} ms")
        print()
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"错误：{e}")
        return False
    
    # 方法2：通过Flask应用上下文检查
    print("6. 通过Flask应用检查:")
    try:
        with app.app_context():
            # 执行SQL查询检查WAL模式
            result = db.session.execute("PRAGMA journal_mode").fetchone()
            journal_mode = result[0]
            print(f"   Journal Mode: {journal_mode}")
            print(f"   WAL模式已启用: {journal_mode == 'wal'}")
            print()
            
    except Exception as e:
        print(f"错误：{e}")
        return False
    
    print("=" * 60)
    print("验证完成")
    print("=" * 60)
    
    return True

def get_synchronous_description(mode):
    """获取同步模式说明"""
    descriptions = {
        0: "OFF - 最快但最不安全",
        1: "NORMAL - 平衡速度和安全",
        2: "FULL - 最安全但较慢"
    }
    return descriptions.get(mode, f"未知模式: {mode}")

def get_temp_store_description(mode):
    """获取临时存储说明"""
    descriptions = {
        0: "DEFAULT - 使用默认存储",
        1: "FILE - 使用文件存储",
        2: "MEMORY - 使用内存存储（更快）"
    }
    return descriptions.get(mode, f"未知模式: {mode}")

if __name__ == "__main__":
    success = verify_wal_mode()
    sys.exit(0 if success else 1)
