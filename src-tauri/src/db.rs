//! 数据库迁移定义。
//! 迁移 SQL 放在 `src-tauri/migrations/`，由 sql 插件在启动时按版本号执行。

pub fn migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![tauri_plugin_sql::Migration {
        version: 1,
        description: "init schema",
        sql: include_str!("../migrations/001_init.sql"),
        kind: tauri_plugin_sql::MigrationKind::Up,
    }]
}
