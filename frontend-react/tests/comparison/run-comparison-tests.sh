#!/bin/bash
# 前端迁移对比测试运行脚本
# 用于运行 Playwright 对比测试并生成报告

echo "========================================"
echo "前端迁移对比测试"
echo "========================================"
echo ""

# 进入脚本所在目录
cd "$(dirname "$0")"

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "[信息] 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
fi

# 检查 Playwright 是否安装
if [ ! -d "node_modules/@playwright" ]; then
    echo "[信息] 正在安装 Playwright..."
    npm install -D @playwright/test
    npx playwright install
    if [ $? -ne 0 ]; then
        echo "[错误] Playwright 安装失败"
        exit 1
    fi
fi

echo ""
echo "[步骤 1/4] 检查服务器状态..."
echo ""

# 检查旧前端服务器 (端口 5000)
if curl -s http://127.0.0.1:5000 > /dev/null 2>&1; then
    echo "[OK] 旧前端服务器 (端口 5000) 运行中"
    OLD_SERVER_RUNNING=1
else
    echo "[警告] 旧前端服务器 (端口 5000) 未运行"
    echo "       请先启动旧前端服务器: cd 开发代码 && python-3.9-embed/python.exe app.py"
    echo ""
    OLD_SERVER_RUNNING=0
fi

# 检查新前端服务器 (端口 5173)
if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
    echo "[OK] 新前端服务器 (端口 5173) 运行中"
    NEW_SERVER_RUNNING=1
else
    echo "[警告] 新前端服务器 (端口 5173) 未运行"
    echo "       请先启动新前端服务器: cd 开发代码/frontend-react && npm run dev"
    echo ""
    NEW_SERVER_RUNNING=0
fi

echo ""

# 如果两个服务器都没有运行，提示用户
if [ $OLD_SERVER_RUNNING -eq 0 ] && [ $NEW_SERVER_RUNNING -eq 0 ]; then
    echo "[错误] 两个服务器都未运行，无法执行对比测试"
    echo ""
    echo "请先启动服务器:"
    echo "  旧前端: cd 开发代码 && python-3.9-embed/python.exe app.py"
    echo "  新前端: cd 开发代码/frontend-react && npm run dev"
    echo ""
    exit 1
fi

echo "[步骤 2/4] 运行对比测试..."
echo ""

# 运行 Playwright 测试
npx playwright test --config=playwright.comparison.config.ts --reporter=list

if [ $? -ne 0 ]; then
    echo ""
    echo "[警告] 部分测试失败"
else
    echo ""
    echo "[OK] 所有测试通过"
fi

echo ""
echo "[步骤 3/4] 生成测试报告..."
echo ""

# 打开 HTML 报告（如果存在）
if [ -f "playwright-report/index.html" ]; then
    echo "测试报告已生成: playwright-report/index.html"
    # macOS
    if command -v open &> /dev/null; then
        open playwright-report/index.html
    # Linux
    elif command -v xdg-open &> /dev/null; then
        xdg-open playwright-report/index.html
    fi
else
    echo "[信息] 未生成 HTML 报告"
fi

echo ""
echo "[步骤 4/4] 完成"
echo ""
echo "========================================"
echo "测试完成！"
echo "========================================"