mod db;
mod shortcuts;
mod tray;

use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 先把"可写数据目录"定下来：WebView2 和 SQLite 都放这里。
    // 不依赖 %APPDATA%/%LOCALAPPDATA% 一定可写（受限环境/便携场景常见问题）。
    let data_dir = writable_data_dir();
    let db_url = init_db_url(&data_dir);
    let webview_dir = data_dir.join("WebView2");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main(app);
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(db_url, db::migrations())
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(move |app| {
            let _ = std::fs::create_dir_all(&webview_dir);
            eprintln!("[setup] data dir = {}", data_dir.display());
            eprintln!("[setup] db url = {db_url}");
            eprintln!("[setup] webview data dir = {}", webview_dir.display());

            let init_script = format!("window.__TOOLTIME_DB_URL__ = {db_url:?};");

            match tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("番茄日历")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .maximized(true)
                .data_directory(webview_dir.clone())
                .initialization_script(&init_script)
                .build()
            {
                Ok(_) => eprintln!("[setup] main window created"),
                Err(err) => eprintln!("[setup] window build failed: {err:?}"),
            }

            let handle = app.handle();
            // 托盘/快捷键失败不应让应用起不来：记录日志后继续
            if let Err(err) = tray::setup(handle) {
                eprintln!("[setup] tray failed: {err}");
            }
            if let Err(err) = shortcuts::setup(handle) {
                eprintln!("[setup] shortcuts failed: {err}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭按钮 = 收进托盘，不退出进程（托盘菜单里才有"退出"）
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn focus_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// 选一个真正可写的目录：用户本地数据 → exe 同级 data/ → 临时目录
fn writable_data_dir() -> PathBuf {
    let candidates = [
        std::env::var("LOCALAPPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("com.tooltime.pomodoro")),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("data"))),
        Some(std::env::temp_dir().join("tooltime")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if is_writable(&candidate) {
            return candidate;
        }
    }

    PathBuf::from(".")
}

/// 目录存在 ≠ 可写，必须用写探针确认
fn is_writable(dir: &std::path::Path) -> bool {
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".write-probe");
    match std::fs::write(&probe, b"ok") {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// sql 插件的迁移是按"数据库 URL 字符串"注册的，前后端必须用同一个 URL
fn init_db_url(dir: &std::path::Path) -> &'static str {
    let _ = std::fs::create_dir_all(dir);
    let path = dir.join("tooltime.db");
    let url = format!("sqlite:{}", path.display().to_string().replace('\\', "/"));
    Box::leak(url.into_boxed_str())
}
