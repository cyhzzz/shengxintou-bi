# -*- coding: utf-8 -*-
"""
配置验证脚本
检查所有必需的配置项是否已正确设置
"""

import os
import sys
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def check_config():
    """检查配置完整性"""
    print("=" * 60)
    print("配置验证检查")
    print("=" * 60)

    all_good = True

    # 检查必需的配置项
    required_configs = {
        'DATABASE_PATH': '数据库路径',
        'FEISHU_APP_ID': '飞书应用ID',
        'FEISHU_APP_SECRET': '飞书应用密钥',
        'WEBDAV_URL': 'WebDAV服务器地址',
        'WEBDAV_USERNAME': 'WebDAV用户名',
        'WEBDAV_PASSWORD': 'WebDAV密码',
    }

    print("\n[必需配置项检查]")
    for key, name in required_configs.items():
        value = os.getenv(key)
        if value and value != '' and not value.startswith('your_') and 'xxx' not in value:
            print(f"[OK] {name} ({key}): 已设置")
        else:
            print(f"[FAIL] {name} ({key}): 未设置或使用了默认值")
            all_good = False

    # 检查可选配置项
    optional_configs = {
        'HOST': '服务器地址',
        'PORT': '服务器端口',
        'DEBUG': '调试模式',
        'LOG_LEVEL': '日志级别',
    }

    print("\n[可选配置项检查]")
    for key, name in optional_configs.items():
        value = os.getenv(key)
        print(f"  {name} ({key}): {value if value else '未设置（使用默认值）'}")

    # 安全检查
    print("\n[安全检查]")

    # 检查是否有硬编码密钥（在 config.py 中）
    try:
        with open('config.py', 'r', encoding='utf-8') as f:
            config_content = f.read()

        hardcoded_secrets = []

        # 检查硬编码的飞书密钥
        if 'FEISHU_APP_SECRET' in config_content and "tpX7hf3xaNgL5NIFXY4mLc0hKfMs2Hu7" in config_content:
            hardcoded_secrets.append('飞书应用密钥')

        # 检查硬编码的WebDAV密码
        if 'WEBDAV_PASSWORD' in config_content and "ap5rset8ifgyj6qs" in config_content:
            hardcoded_secrets.append('WebDAV密码')

        if hardcoded_secrets:
            print(f"[FAIL] 发现硬编码密钥: {', '.join(hardcoded_secrets)}")
            print("  警告: 请移除 config.py 中的硬编码密钥，使用环境变量！")
            all_good = False
        else:
            print("[OK] 未发现硬编码密钥")
    except Exception as e:
        print(f"[WARN] 无法检查硬编码密钥: {e}")

    # 检查 .env 文件是否在 .gitignore 中
    try:
        # 尝试在项目根目录查找 .gitignore
        gitignore_paths = ['.gitignore', '../.gitignore', '../../.gitignore']
        gitignore_content = None

        for path in gitignore_paths:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    gitignore_content = f.read()
                break

        if gitignore_content and '.env' in gitignore_content:
            print("[OK] .env 已在 .gitignore 中")
        else:
            print("[WARN] .env 未在 .gitignore 中，请添加！")
    except Exception as e:
        print(f"[WARN] 无法检查 .gitignore: {e}")

    # 总结
    print("\n" + "=" * 60)
    if all_good:
        print("[OK] 所有配置检查通过！")
        print("  系统已准备就绪，可以安全运行。")
    else:
        print("[FAIL] 配置检查失败！")
        print("  请修复上述问题后再运行系统。")
    print("=" * 60)

    return all_good

if __name__ == '__main__':
    success = check_config()
    sys.exit(0 if success else 1)
