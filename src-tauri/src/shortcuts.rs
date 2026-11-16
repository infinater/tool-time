//! 全局快捷键：Ctrl+Alt+P 开始/暂停，Ctrl+Alt+O 唤起窗口。
//! 通过事件通知前端：`shortcut:toggle-timer` / `shortcut:open-window`。
//!
//! 快捷键注册失败（例如被其它软件占用）只打日志，不影响应用启动。

use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Ctrl+Alt+P：开始 / 暂停 / 继续番茄钟
const TOGGLE_TIMER_LABEL: &str = "Ctrl+Alt+P";
/// Ctrl+Alt+O：把主窗口带到前台并回到"今天"
const OPEN_WINDOW_LABEL: &str = "Ctrl+Alt+O";

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let toggle_timer = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyP);
    let open_window = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyO);

    // Ctrl+Alt+P → 前端按当前 status 分流：running 暂停、paused 继续、idle 开始
    if let Err(err) = app.global_shortcut().on_shortcut(toggle_timer, |app, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        if let Err(err) = app.emit("shortcut:toggle-timer", ()) {
            eprintln!("[shortcuts] 派发 shortcut:toggle-timer 失败：{err}");
        }
    }) {
        eprintln!("[shortcuts] 注册 {TOGGLE_TIMER_LABEL} 失败（可能被其他程序占用）：{err}");
    }

    // Ctrl+Alt+O → 先把窗口 bring to front（Rust 侧保证即使前端没起来也能显示），再通知前端
    if let Err(err) = app.global_shortcut().on_shortcut(open_window, |app, _shortcut, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        crate::focus_main(app);
        if let Err(err) = app.emit("shortcut:open-window", ()) {
            eprintln!("[shortcuts] 派发 shortcut:open-window 失败：{err}");
        }
    }) {
        eprintln!("[shortcuts] 注册 {OPEN_WINDOW_LABEL} 失败（可能被其他程序占用）：{err}");
    }

    Ok(())
}
