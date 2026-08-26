# 数据安全红线：禁止业务数据库进入分发产物

本文件是省心投 BI 的**最高风险安全不变式**。任何涉及打包、发布、数据库初始化或 Release 资产上传的改动，开工前必须先读本节。

## 1. 问题定义

`database/shengxintou.db` 含客户手机号、资产、创收等敏感业务数据。本仓库 `cyhzzz/shengxintou-bi` 为 **PUBLIC**，GitHub Release 资产任何人可下载。一旦把含数据的库打进 APK / EXE / `frontend-dist.zip`，即构成业务数据公开泄露。

历史上已发生并处置：Release 资产（v3.5.8~v3.8.2 的 APK/EXE/frontend-dist.zip）内置真实库，已逐一删除含数据资产，仅保留空库安全版可下载。本规则用于防止复发。

## 2. 三条不可违反的红线

### 红线 1：分发产物一律内置表结构空库，不内置真实数据

- APK（Android）、桌面 EXE（Electron/PyInstaller）、`frontend-dist.zip`（Web/PWA）**只能**携带**表结构空库**（schema-only，0 行业务数据）。
- 真实库 `database/shengxintou.db` **禁止**进入任何被 git 跟踪或 Release 分发的路径，包括但不限于：
  - `android/app/src/main/assets/public/assets/databases/`
  - `frontend-react/dist/`（含 `assets/databases/`）
  - `build-installer.ps1` 打包进的 `server/` 目录
  - 任何上传到 GitHub Release 的 `.apk` / `.exe` / `frontend-dist.zip`
- 移动端真实数据来源：用户首次启动后**自行配置 WebDAV 凭据**，从坚果云 `/shengxintou-backup/` 拉取（详见 `backend/routes/system/` 下的数据同步实现与 `frontend-react/src/services/mobileSync.ts`）。

### 红线 2：空库由构建脚本从 schema 生成，不复制真实库

- 移动端空库生成集中在 `android/scripts/post-sync-patch.ps1`（cap sync 后第 8 步）：从 `database/shengxintou.db` **提取 schema** 生成空库（约 12 表 0 行、~116KB），**不得** `cp`/`Copy-Item` 整个真实库。
- `frontend-dist.zip` 打包（仓库内打包脚本）必须使用 `zipfile` 并**排除 `*.db`**，确保产物无任何数据库文件。
- 改动打包脚本时，必须复核"最终进产物的数据库文件行数 = 0"，不能只看文件存在。

### 红线 3：历史含数据 Release 资产必须清理，不留残留

- 发版或安全审计时，若发现**任何**历史 Release 资产（APK/EXE/frontend-dist.zip/blockmap/latest.yml）内置真实库，必须逐一 `gh release delete-asset` 删除，**release 说明与 git tag 保留**（不影响 git 历史与版本号连续性，只移除二进制）。
- 删除后核验：目标 release 的 `assets` 数量为 0，或仅剩空库安全版资产。
- **仓库保持 PUBLIC**（转私有会挂掉 GitHub Pages 官网部署）。因此泄露面只能靠"产物本身不含数据"关闭，不能依赖私有化兜底。

## 3. 空库首次使用引导（配套体验）

- 空库启动后，移动端/PWA 应检测核心业务表（如 `fact_conv_appmarket`）行数为 0 或查询失败，弹出引导横幅，提示用户配置 WebDAV 并跳转数据同步页。
- 实现位置：`frontend-react/src/components/EmptyDbGuide.tsx` + `frontend-react/src/layouts/MainLayout.tsx`。Web/桌面端不启用；数据同步页自身不显示引导（防循环）。
- 详见 `version.json` changelog 中"移动端空库首次使用引导"条目（具体版本号以 `version.json` 当前值为准，本规则不写死）。

## 4. 涉及本红线的改动前置检查

| 改动类型 | 必查 |
| --- | --- |
| 修改 `post-sync-patch.ps1` | 第 8 步是否仍生成**空库**而非复制真实库；产物 APK 内置 DB 行数 |
| 修改 `build-installer.ps1` 或前端打包脚本 | 是否排除 `*.db`；产物 dist 是否含数据库 |
| 修改 WebDAV 数据同步/备份相关路由 | 备份对象必须是 `database/shengxintou.db` 本身（本地真实库），与"产物不含数据"不冲突 |
| 上传 GitHub Release 资产 | 上传前确认 APK/EXE/dist 不内置真实库；空库安全版可正常发布 |
| 安全审计/历史 Release 巡检 | 对已发布 release 逐一核验资产，发现含数据资产立即删除 |

## 5. 与现有规则的边界

- 本文件是**安全维度**的不变式，不重复 `business-invariants.md` 的业务口径，只约束"数据在分发链路上的可见性"。
- 打包细节（JDK、镜像、全屏、横屏、图标等）见 `testing-and-delivery.md` 第 10 节；该节"内置 DB"条目必须与**红线 1/2** 一致（只内置表结构空库）。
- Git 安全（不提交 `.env`、数据库等）见 `AGENTS.md` 第 9 节；本红线是其在"Release 分发产物"层面的延伸。
