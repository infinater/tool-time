# 当前进度与恢复步骤

最后更新：2026-11-16 21:00

## 已经做完

- 前端应用（React + TS + Vite + Tailwind）已完整可运行，M0 功能齐：
  今天 / 番茄钟 / 日历 / 日记 / 统计占位 / 设置（含导出导入）。
- `pnpm build` 通过（tsc 类型检查 + 生产构建都过）。
- `src-tauri` 桌面壳已搭好：`Cargo.toml`、`tauri.conf.json`、`build.rs`、`main.rs`、`lib.rs`、窗口配置、图标全套已生成。
- Rust 工具链已装好：`rustc 1.100.0` / `cargo 1.100.0`（MSVC）。
- Cargo 镜像已配：`.cargo/config.toml` 指向 rsproxy 稀疏索引（国内拉 crate 快；不需要可删掉这个文件）。

## 唯一没做完的一步

**Tauri 壳的第一次编译还没跑完**（`cargo build` 中途停了）。

原因不是代码问题，而是两段下载：
1. `rustup` 从 `static.rust-lang.org` 拉工具链 → 已改用 `rsproxy.cn` 镜像，**已解决**；
2. `cargo` 拉 tauri 依赖树（约 300+ crate，首次 3–8 分钟）→ **还没跑完**。

编译产物会缓存在 `src-tauri/target`，中断后再跑会接着来，不会从头开始。

## 恢复：双击 `start.cmd` 选 2

```powershell
# 或者命令行
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -Mode desktop
```

首次会看到大量 `Compiling xxx v0.x` 输出，属于正常；结束后弹出「番茄日历」窗口。

打包安装程序：`start.cmd` 选 3（或 `-Mode build`），产物在
`src-tauri\target\release\bundle\nsis\*.exe`。

## 只想先看界面

双击 `start.cmd` 选 1（或 `pnpm dev`），浏览器打开 http://localhost:5183 。

## 数据在哪

M0 用 localStorage，位置在 WebView/浏览器的本地存储里；导出/导入在「设置 → 数据」。
M1 会切到 SQLite（`%APPDATA%\com.tooltime.pomodoro\data.db`），导出格式不变。

---

## 设计提升（Pass A / B / C 已完成，2026-11-16）

按 `docs/审美提升计划-v1.md` 执行完毕，前端构建与类型检查均通过。

**Pass A · token 与排版**
- 重写 CSS 变量：12 阶暖中性色（深色偏暖 2°）、accent 三档（主/浅底/文字色，文字色对比度 ≥4.5:1）
- 字号阶梯 12/13/15/17/20/28，正文 15/1.75，数字统一 `tabular-nums`
- 卡片在深色下去掉描边，改 `inset 0 1px 0 rgba(255,255,255,.04)`；浅色保留 1px 边框
- 圆角分级：控件 9 / 卡片 14 / 弹窗 18
- 全局 `:focus-visible` 焦点环、`prefers-reduced-motion` 降级

**Pass B · 组件**
- 圆环：外圈细线 + 60 格刻度（已完成部分变 accent）+ 12px 进度 + 暂停态降透明度 + 完成闪一下
- 日历：格子 84px，热力改为底部 3px 色条（4 档纯色，不用透明度），心情点右上、日记短竖线右下，今天用红字+小点
- 心情：emoji → 色环 + 文字标签（设置可切回 emoji）
- 工具栏精简，按钮统一三层（primary / soft / ghost），一屏只有一个 primary

**Pass C · 打磨**
- 动效：hover 120ms、状态 180ms、面板 260ms、圆环 500ms linear
- 统计柱状图加基线 + 25/50/75% 网格线，柱宽固定 14px 圆角 3px
- 空状态改为几何构成小图（不引第三方插画）
- 侧栏 logo 从 🍅 emoji 换成矢量番茄，图标统一 lucide 1.75 描边

**可直接看效果**：`design/preview/*.png`（1440×900，五个页面）。

---

## 动效与性能（一档完成，2026-11-16）

目标：顺滑来自时序与克制，不是堆特效。**没有新增任何依赖**。

**0 · 性能前置（先修这个，否则加动画必卡）**
- `tick` 不再把 `now` 写进 store，只负责"到点结算"；渲染完全由 `useRemaining` 在计时器子树内推导
- 只有 `running` 状态才启动 100ms interval，空闲/暂停时零重渲染
- 60 格刻度拆成 `memo` 组件，只在"已走过格数"变化时重建 DOM（原来每秒重建 60 个 `<line>`）
- 进度环改用 `stroke-dashoffset` 140ms linear 追帧，视觉上连续，但 DOM 更新频率降低 10 倍

**1 · 缓动体系**
- 三个 token：`--ease-out-quint`（入场）、`--ease-spring`（弹层/回弹）、`--ease-standard`（hover）
- 按钮按下 `scale(0.975)` 140ms，hover 颜色 120ms，取消所有无意义的 `transition-all`

**2 · 数字过渡**
- `AnimatedNumber`：easeOutCubic 520ms，`tabular-nums` 不抖动
- 已接入：今天页三项、日历月摘要、统计三张卡
- 统计柱状图高度 520ms 缓动生长

**3 · 列表 FLIP**
- 任务勾选/删除后，其余行用 Web Animations API 平滑归位（260ms），不再瞬跳

**4 · 弹层物理感**
- 结束面板：8px 上移 + 0.97→1 缩放 + 淡入，260ms `--ease-out-quint`
- 遮罩单独 160ms 淡入（快于面板，视觉上"先压暗再出内容"）

**5 · 无障碍**
- 全部动效受 `prefers-reduced-motion` 控制；数字过渡在减少动效时直接跳到目标值

**验证方式**
- `?selftest=1` 自动跑一次 3 秒番茄：结果 `{status:idle, flash:1, showFinish:true, sessionStatus:completed, actual:3}`，说明"启动 → 计时 → 结算 → 弹窗"链路正常
- `?debug=1` 读布局尺寸；`tsc --noEmit` 与 `vite build` 均通过

---

## 二档：转场与命令面板（2026-11-16）

这轮用两个 subagent 并行：`palette` 只写 `src/features/palette/`，`transition` 只写 `src/shared/viewTransition.*`，主线程负责 App / 日历的接线与联调（写入范围不重叠）。

**1 · 路由转场**
- `src/shared/viewTransition.ts`：View Transitions API 封装（特性检测、reduced-motion 直更、连续触发不排队、抛错时 skip 并向上抛、`data-vt` 类型标记自动清理）
- 侧栏 `view-transition-name: sidebar` 并禁用其动画，`main` 命名 `page` 只做 140ms 淡出 / 220ms 淡入 —— **侧栏保持静止**，避免整屏闪
- 关键点：`start(() => flushSync(() => navigate(to)))`，不用 flushSync 的话 React 批处理会让新旧快照一样，看起来"没有转场"

**2 · 日历共享元素**
- 每个格子 `view-transition-name: day-YYYY-MM-DD`；选中后该格子的名字交给右侧详情标题，于是转场时格子会"长"成标题块
- 切换日期走 `start(..., { types: ["day"] })`，其余月份切换仍是普通交叉淡入

**3 · 命令面板（Ctrl+K）**
- 子序列模糊匹配，支持拼音首字母（`rj` → 日记、`kz` → 开始专注），命中字符用 accent 高亮
- 四组命令：导航 / 动作 / 任务 / 日期；任务与日期是从 store 实时生成的
- 键盘 ↑↓ 选择、Enter 执行、Esc 关闭；焦点打开时进输入框、关闭时还给原元素；中文输入法组合态不抢 Enter
- 侧栏新增「命令 Ctrl K」入口按钮

**验证**
- `?navtest=1`（临时脚本，已移除）连续触发两次跳转：`{hash:"#/stats", errors:[], hasCalendar:true, hasStats:true}` —— 转场期间无报错，最终落点正确
- `?palette=1` 直接打开面板，DOM 校验通过；`?palette=1` 仅用于截图，不影响正常使用
- `tsc --noEmit`、`vite build` 均通过

**截图**：`design/preview/palette.png`（命令面板）、`calendar.png`（共享元素起点）

---

## 交互强化：专注模式（2026-11-16）

**入口**
- 卡片右上角「放大」按钮
- 设置 → 提醒与外观 → **开始专注时进入专注模式**（默认开）
- 命令面板 `Ctrl+K` → 开始专注（同样会进）

**界面**
- 整窗覆盖（`z-40`），只保留：任务名 chip、超大计时环（直径按窗口高度自适应，300–460px）、暂停/跳过/放弃、退出与全屏按钮、底部今日番茄点
- 背景只有一层 accent 径向光晕（9% 透明度），不加任何装饰
- 入场 `scale(0.965) → 1` + 淡入 280ms；数字与刻度依旧由 `useRemaining` 驱动，不整页重渲染

**键盘**
- `Esc` 退出（同时退出系统全屏）
- `Space` 暂停 / 继续（按钮点击后主动 `blur()`，避免空格同时触发按钮而"暂停又继续"）
- `F` 切换系统全屏（`requestFullscreen`，Tauri 窗口后接原生全屏）

**行为**
- 只有 `work` 类型会自动进专注模式；休息、跳过、放弃、完成都会自动退出
- 完成时先退出专注模式再弹「番茄完成」面板，层级不会打架（专注 40 < 弹窗 50）

**重构**
- 圆环抽成 `TimerDial`（260 / 460 两种尺寸共用同一套刻度与字号比例），卡片和专注模式不再各写一份
- 字号按直径比例计算（`px * 0.177` 等），放大后不会变成"小字大圈"

**验证**
- `?focus=1&run=1`（调试参数）直接打开专注模式并起一个番茄：DOM 含「专注模式 / 暂停 / 跳过 / 放弃 / Esc」与运行中的 `24:5x`
- `tsc --noEmit`、`vite build` 通过
- 截图：`design/preview/focus.png`

---

## 自定义时长（2026-11-16）

**修掉的 bug**：计时按钮之前写死 25 / 5 分钟，完全不读设置里的时长。

**现在的入口**

| 位置 | 能做什么 |
| --- | --- |
| 今天页计时卡片 | 表盘下方 `15 / 25 / 45 / 自定义` 预设；选中即生效，点「开始专注」用这个时长 |
| 自定义 | 点开变成数字输入（1–180 分钟），回车或「确定」生效；选中后按钮显示「40 分 · 自定义」 |
| 恢复默认 | 覆盖值存在时出现，一键回到设置里的默认时长 |
| 运行中 | 「+5 分」延长本次（同时更新数据库里的 `planned_seconds`，统计不会错） |
| 休息按钮 | 自动跟随设置：显示「休息 5 分」，当今天番茄数达到长休息间隔时变成「长休息 15 分」 |
| 设置页 | 专注 / 短休息 / 长休息 / **长休息间隔（个番茄）** / 每日目标，全部可改 |
| 命令面板 | 「开始专注」的副标题会显示当前生效时长 |

**行为细节**
- 覆盖只对「本次」有效，不写回设置；重启应用回到默认
- 专注模式下同样可用「+5 分」；时长数字在表盘上按 `plannedSeconds` 实时反映
- 自定义输入限制 1–180 分钟，非法值回落到边界

**验证**
- `?run=1&len=40`（调试参数）→ 表盘显示运行中的 `39:5x`，卡片标签显示「40 分」，`延长` 按钮存在
- DOM 校验：`15 分 / 25 分 / 45 分 / 自定义 / 休息 5 分` 均渲染
- `tsc --noEmit`、`vite build` 通过

---

## 交互补齐 4 项（2026-11-16）

| # | 交互 | 实现 |
| --- | --- | --- |
| 1 | **表盘滚轮调时长** | 空闲时悬停表盘滚动，±5 分钟（1–180 截断），光标变 `ns-resize`，`title` 提示；运行中滚轮不接管，页面照常滚动 |
| 2 | **记住上次时长** | 选择写入 `settings.workMinutesDraft`（防抖 200ms），启动时恢复；「恢复默认」清空 |
| 3 | **超长预检** | >90 分钟不直接开始，弹确认：「这次 120 分钟，算两个番茄？」，可选「取消 / 改成 45 分钟 / 就按 120 分钟开始」 |
| 4 | **专注模式内调时长** | 空闲态加 15/25/45 预设 + 滚轮微调提示；运行中保留「+5 分」 |

**技术细节**
- 滚轮必须用原生 `addEventListener('wheel', ..., { passive: false })`：React 的 `onWheel` 是 passive 的，`preventDefault()` 无效，会导致表盘滚动时整页跟着滚
- 状态判断全部走 `useTimer.getState()`，避免把 `status` 放进 effect 依赖导致监听反复重建
- 时长覆盖只在"本次"生效但会持久化"上次选择"，语义分开：`workMinutesOverride`（内存）与 `workMinutesDraft`（设置）

**验证**
- `?len=120&run=1` → 渲染确认弹窗（含「就按 120 分钟开始」「改成 45 分钟」），计时未启动
- `?focus=1` → 专注模式空闲态含「15 分」与「滚轮微调 ±5 分」
- 截图：`design/preview/confirm.png`

---

## M1：桌面能力（2026-11-16）

三个 subagent 并行 + 主线程接线。分工按**文件所有权**切，避免互相覆盖：

| 角色 | 独占文件 | 产出 |
| --- | --- | --- |
| agent `tray` | `src-tauri/src/tray.rs` | 托盘图标 + 右键菜单 + 左键唤起 |
| agent `hotkey` | `src-tauri/src/shortcuts.rs`、`src/lib/system.ts` | 全局快捷键 + 系统事件桥 + Toast |
| agent `sqlite` | `src/lib/db.ts`、`src/lib/store.ts`、`migrations/001_init.sql` | SQLite 持久化 |
| 主线程 | `lib.rs`、`Cargo.toml`、`capabilities`、`tauri.conf.json`、`App.tsx` | 插件注册、接线、编译验证 |

**1 · 窗口与托盘**
- 关闭按钮 = 收进托盘（`prevent_close` + `hide`），进程继续跑
- 托盘菜单：开始/暂停、打开今天、显示主窗口、退出；左键单击直接唤起窗口（右键才弹菜单）
- 单实例：二次启动唤起已有窗口，不会开第二个进程

**2 · 全局快捷键**
- `Ctrl+Alt+P` → 开始/暂停（按当前状态分流：运行→暂停、暂停→继续、空闲→开始）
- `Ctrl+Alt+O` → 唤起窗口
- 注册失败只打日志，不影响启动（可能被其他软件占用）

**3 · 完成通知**
- 番茄结束时，若窗口不可见 → Windows Toast：「番茄完成了 / 写设计文档 · 25 分钟」
- 权限未授予时先 `isPermissionGranted` → `requestPermission`，拒绝则静默
- 浏览器环境完全静默（`isTauri()` 守卫 + 动态 import，不加载任何 Tauri 模块）

**4 · SQLite**
- 库文件：`%APPDATA%\com.tooltime.pomodoro\tooltime.db`（迁移在 Rust 启动时执行）
- 表：`tasks / focus_sessions / day_entries / reflections / settings`，snake_case 列，`local_date` 冗余列
- 前端 `src/lib/db.ts`：`isTauri / loadSnapshot / saveSnapshot`；写入用**串行队列**，整快照 upsert + 删除多余行
- `store.ts` 新增 `hydrate()`：App 启动时从库里读一次；浏览器下是 no-op（localStorage 照旧）
- `day_entries` 用 `INSERT OR REPLACE`，避开 `local_date` UNIQUE 冲突

**踩到的坑**
- `libsqlite3-sys` 用 MSVC 编译 `sqlite3.c` 时报 `D8050 无法执行 c1.dll`（命令行过长 + 调试符号）→ 加 `[profile.dev] debug = 0` 解决，同时加快增量编译
- 三个 agent 各自用独立 `CARGO_TARGET_DIR` 验证，避免抢 `target` 目录的锁

**验证**
- `cargo build`：通过（17.6MB 可执行文件）
- `tsc --noEmit` + `vite build`：通过；浏览器版功能无回归（`?debug=1` 布局检查通过）
- **桌面窗口未能实机验证**：当前会话无法创建任何 GUI 进程（连 `notepad.exe` 启动即退出），所以 Tauri 窗口一律报 `os error 5 (拒绝访问)`，属环境限制而非代码问题。需在你自己的桌面会话里双击 `start.cmd` 验证。

### 追查与修复（同日）

用户实机运行后同样报 `os error 5`，继续定位到真实原因：

- 手动建窗并打印错误后得到 `create_dir_all('%LOCALAPPDATA%\com.tooltime.pomodoro\WebView2') -> Access denied`
- 进一步探测：该进程对 `%LOCALAPPDATA%` 和 `%TEMP%` 都写不进去，但能写工作区
- 结论：**WebView2 需要一个可写的数据目录**，默认位置不可写时窗口创建直接失败（`0x8000FFFF 灾难性故障`）

修复：
1. `resolve_webview_dir()`：按 `环境变量 → %LOCALAPPDATA%\…\WebView2 → exe 同级 webview2-data` 依次探测，**用写探针判断可写性**（目录存在 ≠ 可写，这是第一版判断错误的地方）
2. 窗口改为手动创建（`WebviewWindowBuilder`），失败只打日志不 panic；`tauri.conf.json` 的 `windows` 置空避免重复建窗
3. SQLite：受限环境下 sql 插件会在 Rust 侧 panic 且 IPC 不返回 → 前端加 4s 超时，超时一次即熔断退回 localStorage，不再反复触发 panic
4. `tsc` 通过；实机启动成功，CDP 验证 `__TAURI_INTERNALS__` 存在、页面渲染正常
5. 截图：`design/preview/desktop.png`

---

## 打包与快捷方式（2026-11-16）

**产物**
- 安装包：`src-tauri/target/release/bundle/nsis/ToolTime_0.1.0_x64-setup.exe`（2.59 MB，NSIS，可选安装目录 + 开始菜单）
- 便携可执行：`src-tauri/target/release/tool-time.exe`（前端资源已内嵌，不依赖 dev server）
- 快捷方式：`scripts/make-shortcuts.ps1` 已生成桌面「番茄日历」+ 开始菜单项
  - 删除：`... -Uninstall`

**打包时踩到的三个坑（都会导致"跑不起来/白屏"）**

1. **直接用 `cargo build --release` 会加载 devUrl**
   现象：release 版打开的是 `http://localhost:5183/`，没开 dev server 就白屏。
   原因：`tauri::generate_context!` 的生产/开发判定由 Tauri CLI 注入的环境决定。
   结论：**必须用 `pnpm tauri build`（CLI）**，不要直接 cargo。

2. **`panic = "abort"` 会让后台 panic 直接杀进程**
   现象：窗口闪一下就没（SQL 插件在 tokio worker panic）。
   处理：release profile 去掉 `panic = "abort"`，单个插件异常不再导致整个应用退出。

3. **WebView2 / SQLite 依赖的目录不一定可写**
   现象：`os error 5`，窗口建不出来。
   处理：Rust 启动时按 `%LOCALAPPDATA% → exe 同级 data/ → temp` 探测**可写**目录，
   WebView2 数据目录与数据库都落在那里；数据库 URL 通过 `initialization_script` 注入前端，保证迁移键一致。

**数据位置**
- 正常环境：`%LOCALAPPDATA%\com.tooltime.pomodoro\`（tooltime.db + WebView2\）
- 受限环境（AppData 不可写）：exe 同级 `data\`
- SQLite 不可用时：前端 4s 超时后熔断，退回 localStorage，功能不中断

---

## 移除演示数据（2026-11-16）

之前为了"日历不空"，首次启动会生成 21 天的假番茄、心情和两篇假日记。现在全部去掉：

- 删除 `store.ts` 里的 `seedDB()`（约 75 行生成逻辑），`readDB()` 直接返回 `emptyDB()`
- `resetAll()` 去掉 `wipeDemo` 参数，「重置演示数据」按钮从设置页移除
- README 相应文案更新为"从空数据开始，不预置任何记录"
- 已清除磁盘上由旧版本写出的数据：
  `target\release\data`、`target\debug\data`、`target\release\webview2-data`、
  `%LOCALAPPDATA%\com.tooltime.pomodoro`、`%APPDATA%\com.tooltime.pomodoro`
- 重新打包：exe 8.68 MB，安装包 2.59 MB
- 启动验证：`sessions=0`、`localStorage` 空、页面仍在（空状态）







