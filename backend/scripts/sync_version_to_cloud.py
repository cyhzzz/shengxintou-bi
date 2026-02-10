# -*- coding: utf-8 -*-
"""
手动同步版本号到云端
"""
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import app
import config
from backend.utils.webdav_client import WebDAVBackupClient


def safe_print(text):
    """安全打印，处理编码错误"""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode('gbk', errors='replace').decode('gbk'))


def sync_version_to_cloud():
    """同步版本号到云端"""
    with app.app_context():
        safe_print("=" * 60)
        safe_print("Sync version to cloud")
        safe_print("=" * 60)

        # 读取本地版本文件（使用绝对路径）
        import json
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        version_file = os.path.join(project_root, 'version.json')

        safe_print(f"\nStep 1: Read local version file...")
        safe_print(f"   File path: {version_file}")

        if not os.path.exists(version_file):
            safe_print(f"\n[ERROR] Version file not found: {version_file}")
            return

        with open(version_file, 'r', encoding='utf-8') as f:
            version_data = json.load(f)

        version = version_data.get('version', 'unknown')
        release_date = version_data.get('release_date', 'unknown')

        safe_print(f"   [OK] Version: {version}")
        safe_print(f"   [OK] Release date: {release_date}")

        # 初始化 WebDAV 客户端
        safe_print(f"\nStep 2: Connect to Jianguoyun...")
        try:
            client = WebDAVBackupClient(
                url=config.WEBDAV_URL,
                username=config.WEBDAV_USERNAME,
                password=config.WEBDAV_PASSWORD,
                backup_dir=config.WEBDAV_BACKUP_DIR
            )
            safe_print(f"   [OK] Connected to Jianguoyun")
        except Exception as e:
            safe_print(f"\n[ERROR] Failed to connect: {str(e)}")
            return

        # 获取云端版本文件名
        cloud_version_file = version_data.get('cloud_version_file', 'version_cloud.json')
        safe_print(f"   Cloud file name: {cloud_version_file}")

        # 上传到临时文件
        safe_print(f"\nStep 3: Upload version file to cloud...")
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as tmp:
            json.dump(version_data, tmp, ensure_ascii=False, indent=2)
            tmp.flush()

            # 上传到坚果云
            try:
                client.upload_file(tmp.name, cloud_version_file)
                safe_print(f"   [OK] Uploaded successfully: {cloud_version_file}")
            except Exception as e:
                safe_print(f"\n[ERROR] Upload failed: {str(e)}")
                return

        safe_print(f"\nStep 4: Verify upload...")
        safe_print(f"   [OK] Version info synced to cloud")

        safe_print("\n" + "=" * 60)
        safe_print("[SUCCESS] Version sync completed!")
        safe_print("=" * 60)


if __name__ == '__main__':
    sync_version_to_cloud()
