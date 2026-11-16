# 番茄日历 · ToolTime

Windows 桌面端的「番茄钟 + 日历 + 心情 + 日记」。基于设计文档 `docs/番茄钟-产品设计文档-v0.2.md` 实现。

当前进度：**M0 骨架（可运行）**。

---

## 现在能跑什么

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 今天 | ✅ | 问候、今日目标进度、专注时长/番茄数/连续天数、心情、日记摘要、任务清单 |
| 番茄钟 | ✅ | 开始/暂停/继续/跳过/放弃，圆环倒计时，结束时弹「记录心情 + 一句话感想」，可选提示音 |
| 日历 | ✅ | 月视图、专注热力底色、心情点、日记角标、月度摘要、点击看当天记录 |
| 日记 | ✅ | Markdown 编辑 + 实时预览、模板、粗体/代码快捷键、自动保存（800ms）、按日期前后翻 |
| 统计 | 🟡 占位 | 本月三项汇总 + 最近 14 天柱状图；趋势图/相关性报表留到 M4 |
| 设置 | ✅ | 时长、自动开始休息、提示音、主题、周起始日、导出/导入 JSON、清空数据 |
| 托盘 / 全局快捷键 / Toast | ✅ | 桌面壳：关闭收托盘、Ctrl+Alt+P 开始暂停、完成弹 Windows 通知 |
| SQLite | ✅ | `%APPDATA%\com.tooltime.pomodoro\tooltime.db`；浏览器下自动回退 localStorage |

## 快速开始

**最简单：双击 `start.cmd`**，按提示选 1（浏览器）/ 2（桌面窗口）/ 3（打包安装程序）。

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

> 本机当前没有全局 pnpm 时，可以用：`node "C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" <命令>`。

应用从空数据开始，不预置任何记录。设置页有「清空数据」。

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

## 下一步（M1）

1. 把数据层从 localStorage 换成 Tauri SQLite（表结构见设计文档 §7.2），保留导出格式。
2. Rust 侧计时器命令（`start_timer/pause/resume/tick 事件`），避免窗口隐藏时 WebView 节流。
3. 托盘图标 + 菜单、全局快捷键 `Ctrl+Alt+P`、关闭到托盘。
4. Windows Toast 通知 + 安装版 AUMID。
5. 迷你置顶窗（320×120）。

## 已知限制

- 未做多设备同步（按设计 v1 明确不做）。
- 统计页只有基础汇总，图表在 M4。
- 打包未签名，SmartScreen 可能提示。
- **桌面窗口尚未实机验证**：开发环境无法创建 GUI 进程（`notepad.exe` 也起不来），`tool-time.exe` 在此环境启动会报 `os error 5`。请在自己的桌面会话里用 `start.cmd` 选 2 验证。
- 未安装的绿色版可能收不到 Toast（Windows 需要 AUMID，安装版更稳）。
