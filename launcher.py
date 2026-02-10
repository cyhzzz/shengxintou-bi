"""
省心投 BI - 启动器（打包版）
使用便携Python环境启动应用
"""
import sys
import os
import subprocess
import time
import webbrowser
from pathlib import Path

class Launcher:
    def __init__(self):
        # 关键：使用sys.executable获取exe文件的实际路径
        # PyInstaller打包后，__file__指向临时目录，而sys.executable指向实际的exe文件
        if getattr(sys, 'frozen', False):
            # PyInstaller打包后的环境
            self.base_dir = Path(sys.executable).parent
        else:
            # 开发环境
            self.base_dir = Path(__file__).parent

        self.portable_python_dir = self.base_dir / "python-3.9-embed"
        self.lib_dir = self.base_dir / "lib"

        # 便携Python可执行文件
        if os.name == 'nt':  # Windows
            self.portable_python = self.portable_python_dir / "python.exe"
        else:
            self.portable_python = self.portable_python_dir / "bin" / "python3"

        self.server_process = None

    def check_environment(self):
        """检查环境"""
        print(f"[检查] Python环境: {self.portable_python_dir}")
        print(f"[检查] 依赖目录: {self.lib_dir}")
        print(f"[检查] 应用目录: {self.base_dir}")

        if not self.portable_python.exists():
            print("[错误] 便携Python不存在")
            return False

        if not (self.base_dir / "app.py").exists():
            print("[错误] app.py 不存在")
            return False

        print("[OK] 环境检查通过")
        return True

    def start_server(self):
        """启动Flask服务器"""
        try:
            # 配置环境变量
            env = os.environ.copy()
            # 关键修复：PYTHONPATH 顺序必须是：
            # 1. portable_python_dir - 标准 Python 模块（select.pyd 等）
            # 2. lib_dir - 第三方依赖库
            # 3. base_dir - 应用代码
            # 这样既能找到标准库模块，又能优先使用第三方库
            env["PYTHONPATH"] = str(self.portable_python_dir) + os.pathsep + str(self.lib_dir) + os.pathsep + str(self.base_dir)
            env["PYTHONHOME"] = str(self.portable_python_dir)
            env["DEV_MODE"] = "1"  # 开发模式，使用浏览器（exe图标为省心投LOGO）

            # 切换到base_dir
            os.chdir(self.base_dir)

            print(f"[启动] 正在启动服务器...")
            print(f"[工作目录] {os.getcwd()}")

            # 启动Flask服务
            # 不使用PIPE，让输出直接显示在控制台
            self.server_process = subprocess.Popen(
                [str(self.portable_python), "app.py"],
                env=env
                # 移除 stdout=subprocess.PIPE, stderr=subprocess.PIPE
                # 这样服务器端的日志可以直接显示在控制台
            )

            # 等待服务器启动
            print("[等待] 等待服务器初始化...")
            time.sleep(3)

            # 检查进程状态（3秒后检查是否还在运行）
            if self.server_process.poll() is not None:
                print(f"[错误] 服务器启动失败，退出码: {self.server_process.returncode}")
                print("[提示] 查看上方日志了解详细错误信息")
                return False

            print("[OK] 服务器启动成功")
            return True

        except Exception as e:
            print(f"[错误] 启动服务器失败: {e}")
            return False

    def open_browser(self):
        """打开浏览器"""
        try:
            print("[浏览器] 正在打开浏览器...")
            webbrowser.open("http://127.0.0.1:5000")
            print("[OK] 浏览器已打开")
        except Exception as e:
            print(f"[警告] 自动打开浏览器失败: {e}")
            print("[提示] 请手动访问: http://127.0.0.1:5000")

    def run(self):
        """运行启动器"""
        print("=" * 60)
        print("省心投 BI - 启动器")
        print("=" * 60)
        print()

        # 1. 检查环境
        if not self.check_environment():
            # 在noconsole模式下，使用time.sleep让用户看到错误消息
            print("[提示] 5秒后自动退出...")
            import time
            time.sleep(5)
            return

        print()

        # 2. 启动服务器
        if not self.start_server():
            print("[提示] 5秒后自动退出...")
            import time
            time.sleep(5)
            return

        print()

        # 3. 打开浏览器（仅在浏览器模式下需要）
        # pywebview模式下，app.py会自动创建窗口，不需要手动打开浏览器
        if os.environ.get('DEV_MODE', '0') == '1':
            self.open_browser()

        print()
        print("=" * 60)
        print("应用已启动！")
        print(f"访问地址: http://127.0.0.1:5000")
        print(f"关闭此窗口即可停止服务器")
        print("=" * 60)
        print()

        # 等待服务结束
        try:
            self.server_process.wait()
        except KeyboardInterrupt:
            print("\n[停止] 正在停止服务器...")
            self.server_process.terminate()
            self.server_process.wait()
            print("[OK] 服务器已停止")

if __name__ == "__main__":
    launcher = Launcher()
    launcher.run()
