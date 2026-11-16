//! 托盘图标与右键菜单。
//! 菜单项通过事件通知前端：`tray:toggle-timer` / `tray:open-today`。

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter,
};

/// 菜单项 id（仅用于本地分发，不影响前端事件名）
const MENU_TOGGLE_TIMER: &str = "tray-toggle-timer";
const MENU_OPEN_TODAY: &str = "tray-open-today";
const MENU_SHOW_MAIN: &str = "tray-show-main";
const MENU_QUIT: &str = "tray-quit";

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    // 1. 右键菜单
    let toggle = MenuItem::with_id(app, MENU_TOGGLE_TIMER, "开始 / 暂停", true, None::<&str>)?;
    let open_today = MenuItem::with_id(app, MENU_OPEN_TODAY, "打开今天", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let show_main = MenuItem::with_id(app, MENU_SHOW_MAIN, "显示主窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "退出", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&toggle, &open_today, &separator, &show_main, &quit],
    )?;

    // 2. 图标：优先复用窗口图标，缺失时回退到打包的 PNG
    let icon = match app.default_window_icon().cloned() {
        Some(icon) => icon,
        None => tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))?,
    };

    // 3. 托盘本体；build 会把图标注册进资源表，这里无需额外保存句柄
    TrayIconBuilder::with_id("main-tray")
        .tooltip("番茄日历")
        .icon(icon)
        .menu(&menu)
        // Windows：右键才弹菜单，左键留给「显示窗口」
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if let Err(err) = handle_menu_event(app, event.id.as_ref()) {
                eprintln!("[tray] 处理菜单事件失败: {err}");
            }
        })
        .on_tray_icon_event(|tray, event| {
            // 左键单击 → 显示并聚焦主窗口（右键由菜单接管）
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::focus_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// 菜单点击分发。事件名与前端监听保持一致，错误交由调用方记录。
fn handle_menu_event(app: &AppHandle, id: &str) -> tauri::Result<()> {
    match id {
        MENU_TOGGLE_TIMER => app.emit("tray:toggle-timer", ())?,
        MENU_OPEN_TODAY => {
            crate::focus_main(app);
            app.emit("tray:open-today", ())?;
        }
        MENU_SHOW_MAIN => crate::focus_main(app),
        MENU_QUIT => app.exit(0),
        _ => {}
    }
    Ok(())
}
