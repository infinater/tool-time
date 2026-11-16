//! 数据库迁移定义。
//! 迁移 SQL 放在 `src-tauri/migrations/`，由 sql 插件在启动时按版本号执行。

pub fn migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "init schema",
            sql: include_str!("../migrations/001_init.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        // v2：focus_sessions 加心情、day_entries 加归档状态（纯 ALTER，旧库可直接升级）
        tauri_plugin_sql::Migration {
            version: 2,
            description: "mood and journal archive",
            sql: include_str!("../migrations/002_mood_archive.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
    ]
}
