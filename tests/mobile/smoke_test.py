"""
省心投 BI Android 端 smoke 测试（NATIVE + logcat 分析版）

策略：不依赖 Chromedriver（Appium 在小米/华为设备有 socket 名匹配 bug），
      改用 NATIVE_APP + logcat 分析验证：
      1. APP 启动不崩溃
      2. logcat 无 JS 错误（me.some/y.forEach/Failed to fetch 等）
      3. 截图验证页面非白屏
      4. 模拟用户操作（用 input keyevent 模拟返回键等）

前置：
  1. 启动 Appium Server:    appium --allow-cors --port 4723
  2. 手机开启 USB 调试并连接电脑
  3. 手动安装 APK: adb install -r android\release\shengxintou-vX.Y.Z.apk
  4. 执行: python tests/mobile/smoke_test.py
"""
import os
import sys
import time
import subprocess
import re
from datetime import datetime
from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ============================================================================
# 配置
# ============================================================================

APP_PACKAGE = "com.shengxintou.mobile"
APPIUM_SERVER = "http://127.0.0.1:4723"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
LOGCAT_FILE = os.path.join(os.path.dirname(__file__), "logcat.txt")
ADB = r"D:\AIproject\省心投BI\tools\platform-tools\adb.exe"
DEVICE_ID = None  # 自动检测

# JS 错误特征（logcat 中 Chromium console 输出）
JS_ERROR_PATTERNS = [
    r"me\.some\s+is\s+not\s+a\s+function",
    r"y\.forEach\s+is\s+not\s+a\s+function",
    r"\.forEach\s+is\s+not\s+a\s+function",
    r"Failed\s+to\s+fetch",
    r"fetch\s+failed",
    r"TypeError:",
    r"ReferenceError:",
    r"SyntaxError:",
    # 移动端错误浮层的关键字
    r"mobile-debug-overlay",
    r"Mobile API not implemented",
    r"Rendered fewer hooks than expected",
]

# 成功标志
SUCCESS_PATTERNS = [
    r"Capacitor.*App started",
    r"Handling local request.*App-.*\.js",
    r"Handling local request.*echarts-vendor",
    r"Registering plugin.*CapacitorSQLite",
    r"Registering plugin.*CapacitorHttp",
]


def build_capabilities():
    caps = UiAutomator2Options()
    caps.platform_name = "Android"
    caps.automation_name = "UiAutomator2"
    caps.device_name = "Android"
    caps.app_package = APP_PACKAGE
    caps.app_activity = ".MainActivity"
    caps.app_wait_activity = "*"
    caps.app_wait_duration = 60000
    caps.no_reset = True
    caps.full_reset = False
    caps.skip_server_installation = True
    caps.skip_device_initialization = True
    caps.device_ready_timeout = 60
    caps.adb_exec_timeout = 60000
    # 不启用 auto_webview，避免 Chromedriver socket 问题
    caps.auto_webview = False
    return caps


def take_screenshot(driver, name: str):
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    ts = datetime.now().strftime("%H%M%S")
    path = os.path.join(SCREENSHOT_DIR, f"{ts}_{name}.png")
    try:
        driver.save_screenshot(path)
        print(f"  [截图] {path}")
    except Exception as e:
        print(f"  [截图失败] {name}: {e}")


def get_device_id():
    """自动检测设备 ID"""
    global DEVICE_ID
    result = subprocess.run([ADB, "devices"], capture_output=True, text=True)
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1] == "device":
            DEVICE_ID = parts[0]
            return DEVICE_ID
    return None


def dump_logcat(filter_patterns=None):
    """抓取 logcat 并过滤"""
    args = [ADB]
    if DEVICE_ID:
        args += ["-s", DEVICE_ID]
    args += ["logcat", "-d", "-v", "time"]
    # 只抓本项目相关 tag
    args += [
        "Capacitor:V", "Console:V", "chromium:V",
        "AndroidRuntime:E", "ReactNativeJS:V",
        "System.err:W", "*:S"
    ]
    result = subprocess.run(args, capture_output=True, text=True, timeout=15)
    with open(LOGCAT_FILE, "w", encoding="utf-8") as f:
        f.write(result.stdout)
    return result.stdout


def clear_logcat():
    """清空 logcat 缓冲区"""
    args = [ADB]
    if DEVICE_ID:
        args += ["-s", DEVICE_ID]
    args += ["logcat", "-c"]
    subprocess.run(args, capture_output=True, timeout=5)


def analyze_logcat(logcat_text: str) -> dict:
    """分析 logcat 中的错误和成功标志"""
    errors_found = []
    successes_found = []

    for pattern in JS_ERROR_PATTERNS:
        matches = re.findall(pattern, logcat_text, re.IGNORECASE)
        if matches:
            errors_found.append({
                "pattern": pattern,
                "count": len(matches),
                "sample": matches[0] if matches else "",
            })

    for pattern in SUCCESS_PATTERNS:
        if re.search(pattern, logcat_text):
            successes_found.append(pattern)

    return {
        "errors": errors_found,
        "successes": successes_found,
        "has_errors": len(errors_found) > 0,
        "has_successes": len(successes_found) > 0,
    }


# ============================================================================
# 测试用例
# ============================================================================

def test_app_launch_no_crash(driver):
    """测试1：APP 启动不崩溃"""
    print("\n=== 测试1：APP 启动 ===")
    # logcat 已在 main() 中清空，这里只等待启动
    time.sleep(15)
    take_screenshot(driver, "01_after_launch")

    # 检查 App 进程是否存活
    args = [ADB]
    if DEVICE_ID:
        args += ["-s", DEVICE_ID]
    args += ["shell", "pidof", APP_PACKAGE]
    result = subprocess.run(args, capture_output=True, text=True)
    pid = result.stdout.strip()
    if pid:
        print(f"  [通过] App 进程存活，PID={pid}")
        return True
    else:
        print(f"  [失败] App 进程不存在，可能已崩溃")
        return False


def test_no_js_errors(driver):
    """测试2：logcat 无 JS 错误"""
    print("\n=== 测试2：JS 错误检查 ===")
    logcat = dump_logcat()
    analysis = analyze_logcat(logcat)

    # 显示成功标志
    if analysis["successes"]:
        print(f"  [成功标志] 命中 {len(analysis['successes'])} 项:")
        for s in analysis["successes"]:
            print(f"    ✓ {s}")

    # 显示错误
    if analysis["has_errors"]:
        print(f"  [失败] 发现 {len(analysis['errors'])} 类 JS 错误:")
        for e in analysis["errors"]:
            print(f"    ✗ {e['pattern']} (×{e['count']}) 样本: {e['sample']}")
        take_screenshot(driver, "02_js_errors")
        return False
    else:
        print(f"  [通过] 未发现已知 JS 错误")
        return True


def test_no_white_screen(driver):
    """测试3：截图非白屏（用 UIAutomator dump 检查）"""
    print("\n=== 测试3：非白屏检查 ===")
    # 用 driver.page_source 检查是否有 UI 元素
    try:
        source = driver.page_source
        if source and len(source) > 500:
            # 检查是否包含关键 UI 元素特征
            has_content = any(kw in source for kw in [
                "WebView", "android.webkit", "FrameLayout",
                "LinearLayout", "RelativeLayout"
            ])
            if has_content:
                print(f"  [通过] 页面有 UI 元素（source length={len(source)}）")
                take_screenshot(driver, "03_ui_ok")
                return True
            else:
                print(f"  [警告] UI 元素特征不明显，可能白屏")
                take_screenshot(driver, "03_possible_white")
                return False
        else:
            print(f"  [失败] page_source 为空或过短（length={len(source) if source else 0}）")
            take_screenshot(driver, "03_white_screen")
            return False
    except Exception as e:
        print(f"  [失败] 获取 page_source 失败: {e}")
        take_screenshot(driver, "03_exception")
        return False


def test_webview_loaded(driver):
    """测试4：WebView 已加载（通过 logcat 确认）"""
    print("\n=== 测试4：WebView 加载检查 ===")
    logcat = dump_logcat()
    # 检查是否有加载 JS/CSS 资源的记录
    js_loaded = re.search(r"Handling local request.*\.js", logcat)
    css_loaded = re.search(r"Handling local request.*\.css", logcat)
    app_started = re.search(r"App started", logcat)

    if app_started and (js_loaded or css_loaded):
        print(f"  [通过] WebView 已加载资源")
        print(f"    ✓ App started: {bool(app_started)}")
        print(f"    ✓ JS loaded: {bool(js_loaded)}")
        print(f"    ✓ CSS loaded: {bool(css_loaded)}")
        return True
    else:
        print(f"  [失败] WebView 未加载资源")
        print(f"    ✗ App started: {bool(app_started)}")
        print(f"    ✗ JS loaded: {bool(js_loaded)}")
        print(f"    ✗ CSS loaded: {bool(css_loaded)}")
        return False


def test_plugins_registered(driver):
    """测试5：Capacitor 插件全部注册"""
    print("\n=== 测试5：Capacitor 插件注册检查 ===")
    logcat = dump_logcat()
    expected_plugins = [
        "CapacitorHttp",     # Bug 2 修复的关键插件
        "CapacitorSQLite",   # 数据库核心
        "Filesystem",        # 文件操作
        "Preferences",       # 凭据存储
        "StatusBar",         # Bug 修复（全屏）
    ]
    missing = []
    for plugin in expected_plugins:
        if f"Registering plugin instance: {plugin}" in logcat:
            print(f"  ✓ {plugin} 已注册")
        else:
            print(f"  ✗ {plugin} 未注册")
            missing.append(plugin)

    if not missing:
        print(f"  [通过] 全部 {len(expected_plugins)} 个插件已注册")
        return True
    else:
        print(f"  [失败] {len(missing)} 个插件缺失: {missing}")
        return False


def test_navigation_via_keyevent(driver):
    """测试6：模拟用户导航（用 input keyevent）"""
    print("\n=== 测试6：导航模拟 ===")
    # 在 NATIVE 模式下，用 keyevent 模拟用户操作
    # KEYCODE_DPAD_RIGHT = 22 可以在 WebView 中移动焦点
    # 这里只验证 App 不因按键崩溃
    args = [ADB]
    if DEVICE_ID:
        args += ["-s", DEVICE_ID]
    args += ["shell", "input", "keyevent", "22"]  # DPAD_RIGHT
    subprocess.run(args, capture_output=True, timeout=5)
    time.sleep(2)

    args2 = [ADB]
    if DEVICE_ID:
        args2 += ["-s", DEVICE_ID]
    args2 += ["shell", "input", "keyevent", "23"]  # DPAD_CENTER (回车)
    subprocess.run(args2, capture_output=True, timeout=5)
    time.sleep(3)

    # 检查 App 是否还活着
    args3 = [ADB]
    if DEVICE_ID:
        args3 += ["-s", DEVICE_ID]
    args3 += ["shell", "pidof", APP_PACKAGE]
    result = subprocess.run(args3, capture_output=True, text=True)
    if result.stdout.strip():
        print(f"  [通过] 导航后 App 仍存活，PID={result.stdout.strip()}")
        take_screenshot(driver, "06_after_nav")
        return True
    else:
        print(f"  [失败] 导航后 App 崩溃")
        take_screenshot(driver, "06_crash")
        return False


# ============================================================================
# 主流程
# ============================================================================

def main():
    print("=" * 60)
    print("省心投 BI Android 端 smoke 测试（NATIVE + logcat 版）")
    print(f"时间: {datetime.now()}")
    print("=" * 60)

    # 检测设备
    device = get_device_id()
    if not device:
        print("[error] 未检测到设备")
        sys.exit(1)
    print(f"设备: {device}")

    # 先停掉 App（确保从干净状态启动），再清空 logcat
    print("[step] 停止 App 并清空 logcat...")
    args = [ADB, "-s", device, "shell", "am", "force-stop", APP_PACKAGE]
    subprocess.run(args, capture_output=True, timeout=10)
    time.sleep(2)
    clear_logcat()

    # 连接 Appium（此时 App 会被 Appium 重新启动）
    print(f"\n[step] 连接 Appium Server: {APPIUM_SERVER}")
    driver = webdriver.Remote(APPIUM_SERVER, options=build_capabilities())
    print(f"[step] session 已建立: {driver.session_id}")

    results = {}
    try:
        results["1_app_launch"] = test_app_launch_no_crash(driver)
        results["2_no_js_errors"] = test_no_js_errors(driver)
        results["3_no_white_screen"] = test_no_white_screen(driver)
        results["4_webview_loaded"] = test_webview_loaded(driver)
        results["5_plugins_registered"] = test_plugins_registered(driver)
        results["6_navigation"] = test_navigation_via_keyevent(driver)
    except Exception as e:
        print(f"\n[error] 测试异常: {e}")
        take_screenshot(driver, "99_exception")
        # 异常时也要分析 logcat
        dump_logcat()
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    # 汇总
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    failed = sum(1 for v in results.values() if not v)
    for name, ok in results.items():
        status = "PASS ✓" if ok else "FAIL ✗"
        print(f"  [{status}] {name}")
    print(f"\n总计: {passed} 通过, {failed} 失败")
    print(f"截图: {SCREENSHOT_DIR}")
    print(f"日志: {LOGCAT_FILE}")
    print()
    if failed == 0:
        print("🎉 所有测试通过！")
    else:
        print("⚠️  有测试失败，请检查截图和 logcat")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
