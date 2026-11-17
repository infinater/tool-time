# 番茄日历 · ToolTime

Windows 桌面端的「番茄钟 + 日历 + 心情 + 日记」。基于设计文档 `docs/番茄钟-产品设计文档-v0.2.md` 实现。

当前进度：**M0 骨架（可运行）**。

---

## 现在能跑什么

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 今天 | ✅ | 今日目标进度、专注时长/番茄数/连续天数、心情与**开心度仪表**、日记摘要、任务清单 |
| 番茄钟 | ✅ | 预设/自定义时长、滚轮微调、暂停/跳过/放弃、+5 分钟、结束时记录本次心情 |
| 专注模式 | ✅ | 表盘占屏高约 3/4、随进度**由暖转深**、右侧名言轮播、`Esc/Space/F` 快捷键 |
| 日历 | ✅ | 月视图热力 + 心情点 + 日记状态点、**计时中呼吸点**、悬停预览、当日详情与快捷操作 |
| 日记 | ✅ | Markdown 编辑/预览、模板、自动保存、**草稿⟷归档**双态、日记库（筛选/搜索/多选删除） |
| 心情与开心度 | ✅ | 每次专注记心情，按专注时长加权算出 0–100 开心度 + 14 天趋势 |
| 统计 | 🟡 部分 | 本月汇总、14 天专注柱状图、开心度仪表与趋势；相关性/周报待做 |
| 设置 | ✅ | 时长、提示音、主题、周起始日、导入导出 JSON、**按范围清空** |
| 托盘 / 快捷键 / 通知 | ✅ | 关闭收托盘、`Ctrl+Alt+P` 开始暂停、完成弹 Windows 通知 |
| 命令面板 | ✅ | `Ctrl+K` 模糊搜索，支持拼音首字母（`rj` → 日记） |
| SQLite | ✅ | `%LOCALAPPDATA%\com.tooltime.pomodoro\`；不可用时自动回退 localStorage |

## 环境要求

| 用途 | 需要 |
| --- | --- |
| 只跑浏览器版 | Node.js 18+、pnpm（或 corepack） |
| 构建桌面版 | 上述 + **Rust stable（MSVC 工具链）** + **Visual Studio Build Tools（C++ 桌面开发）** + Windows SDK |
| 运行桌面版 | 上述 + **WebView2 Runtime**（Win11 自带；Win10 需装 [Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)） |

## 快速开始

**最简单：双击 `start.cmd`**，按提示选 1（浏览器）/ 2（桌面窗口）/ 3（打包安装程序）/ 4（创建快捷方式）。

手动命令：

```powershell
# 依赖（已安装可跳过）
npm i -g pnpm

pnpm install

# 方式一：浏览器里跑（最快，界面/逻辑全都在）
pnpm dev            # http://localhost:5183

# 方式二：桌面窗口（需要 Rust 工具链 + WebView2）
pnpm tauri:dev

# 打包安装程序（NSIS）
pnpm tauri:build
```

应用从空数据开始，不预置任何记录。设置页有「清空数据」。

### 国内网络加速（可选）

拉 Rust 依赖慢时，在项目根建 `.cargo/config.toml`（已被 gitignore）：

```toml
[source.crates-io]
replace-with = "rsproxy-sparse"

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"
```

装 Rust 时同理：`$env:RUSTUP_DIST_SERVER="https://rsproxy.cn"`。

## 常见问题

| 现象 | 原因 / 解决 |
| --- | --- |
| `cl: 命令行 error D8050 无法执行 c1.dll` | MSVC 编译 sqlite3.c 时命令行过长。已在 `src-tauri/Cargo.toml` 设 `[profile.dev] debug = 0`，不要改回去 |
| 窗口一闪而过 / `os error 5 拒绝访问` | WebView2 数据目录不可写。程序会自动回退到 exe 同级 `data\`；若仍失败，检查磁盘权限 |
| 桌面版打开是白屏且地址是 `localhost:5183` | 用了 `cargo build --release` 直接构建。**必须用 `pnpm tauri build`**，否则会被当成 dev 模式加载 dev server |
| 端口 5183 被占用 | 先关掉旧的 `pnpm dev` 窗口；`vite.config.ts` 里是 `strictPort: true` |
| 收不到完成通知 | 未安装的绿色版没有 AUMID，Toast 可能不弹；用安装包安装后正常 |
| 数据存在哪 | 正常：`%LOCALAPPDATA%\com.tooltime.pomodoro\`；受限环境：exe 同级 `data\`；SQLite 不可用时回退 localStorage |

## 项目结构

```
src/
├── app/                  # 应用外壳：侧栏、路由、主题、全局时钟
├── features/
│   ├── timer/            # 计时状态机（zustand）、圆环、结束面板
│   ├── today/            # 今天页
│   ├── calendar/         # 月视图 + 当天详情
│   ├── journal/          # Markdown 编辑/预览 + 自动保存
│   ├── mood/             # 心情选择器
│   ├── stats/            # 统计占位
│   └── settings/
├── shared/MarkdownView   # 统一的 Markdown 渲染样式
├── lib/
│   ├── types.ts          # 数据模型（与设计文档 §7 对齐）
│   ├── store.ts          # 数据层（当前 localStorage，接口稳定后可换 SQLite）
│   ├── selectors.ts      # 派生统计：日/月汇总、热力等级、streak
│   └── utils.ts          # 日期、时长、格式化
src-tauri/                # Tauri 壳（Rust），窗口配置与图标已就绪
docs/                     # 设计文档
```

## 关键设计落点

- **计时权威时间是时间戳**：`remaining = planned - (now - startedAt - pausedTotal)`，不靠累加 tick，最小化/休眠不跑偏。
- **按本地日期归属**：每条 session 冗余 `localDate`，日历与统计都按它对齐，跨零点不会算错。
- **Markdown 是唯一真相**：日记存储为纯字符串，预览只读渲染，将来换 CodeMirror/Milkdown 不影响数据。
- **不做强制打卡**：结束面板「跳过」永远可见，空状态文案中性。

## 路线图

已完成的能力与后续计划都整理在 **[docs/项目进展与路线图.md](docs/项目进展与路线图.md)**。

近期（v0.3.0 方向）：周视图、统计报表、日记插图、批量导出 Markdown。

## 已知限制

- 未做多设备同步（按设计 v1 明确不做）。
- 统计页只有基础汇总，趋势报表在后续版本。
- 打包未签名，SmartScreen 可能提示。
- 未安装的绿色版可能收不到 Toast（Windows 需要 AUMID，安装版更稳）。

## 许可证

[MIT](LICENSE) © 2026 infinater
