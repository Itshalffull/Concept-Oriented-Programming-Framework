// Storage adapter scaffold generator: generates boilerplate for storage backend adapters.
// Supports backends: memory, sqlite, postgres, redis, s3.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::StorageAdapterScaffoldGenHandler;
use serde_json::json;

pub struct StorageAdapterScaffoldGenHandlerImpl;

fn to_kebab(name: &str) -> String {
    let mut result = String::new();
    for (i, c) in name.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('-');
        }
        result.push(c.to_ascii_lowercase());
    }
    result.replace(' ', "-").replace('_', "-")
}

fn generate_adapter_files(name: &str, backend: &str) -> Vec<serde_json::Value> {
    let kebab = to_kebab(name);
    let pascal = name.chars().next().map(|c| c.to_uppercase().to_string()).unwrap_or_default()
        + &name[1..];

    let adapter_content = match backend {
        "sqlite" => format!(
            r#"// Storage adapter: {} (SQLite backend)
use rusqlite::{{Connection, params}};
use serde_json::Value;

pub struct {}Adapter {{
    conn: Connection,
}}

impl {}Adapter {{
    pub fn new(path: &str) -> Result<Self, Box<dyn std::error::Error>> {{
        let conn = Connection::open(path)?;
        conn.execute_batch("CREATE TABLE IF NOT EXISTS kv (relation TEXT, key TEXT, value TEXT, PRIMARY KEY (relation, key))")?;
        Ok(Self {{ conn }})
    }}

    pub fn get(&self, relation: &str, key: &str) -> Result<Option<Value>, Box<dyn std::error::Error>> {{
        let mut stmt = self.conn.prepare("SELECT value FROM kv WHERE relation = ?1 AND key = ?2")?;
        let result = stmt.query_row(params![relation, key], |row| row.get::<_, String>(0)).ok();
        Ok(result.and_then(|s| serde_json::from_str(&s).ok()))
    }}

    pub fn put(&self, relation: &str, key: &str, value: Value) -> Result<(), Box<dyn std::error::Error>> {{
        self.conn.execute("INSERT OR REPLACE INTO kv (relation, key, value) VALUES (?1, ?2, ?3)", params![relation, key, serde_json::to_string(&value)?])?;
        Ok(())
    }}

    pub fn del(&self, relation: &str, key: &str) -> Result<(), Box<dyn std::error::Error>> {{
        self.conn.execute("DELETE FROM kv WHERE relation = ?1 AND key = ?2", params![relation, key])?;
        Ok(())
    }}
}}"#, name, pascal, pascal),
        "postgres" => format!(
            "// Storage adapter: {} (PostgreSQL backend)\n// TODO: Implement using tokio-postgres\npub struct {}Adapter;\n", name, pascal),
        "redis" => format!(
            "// Storage adapter: {} (Redis backend)\n// TODO: Implement using redis-rs\npub struct {}Adapter;\n", name, pascal),
        "s3" => format!(
            "// Storage adapter: {} (S3 backend)\n// TODO: Implement using aws-sdk-s3\npub struct {}Adapter;\n", name, pascal),
        _ => format!(
            r#"// Storage adapter: {} (in-memory backend)
use std::collections::HashMap;
use std::sync::RwLock;
use serde_json::Value;

pub struct {}Adapter {{
    data: RwLock<HashMap<String, HashMap<String, Value>>>,
}}

impl {}Adapter {{
    pub fn new() -> Self {{
        Self {{ data: RwLock::new(HashMap::new()) }}
    }}

    pub fn get(&self, relation: &str, key: &str) -> Result<Option<Value>, Box<dyn std::error::Error>> {{
        let data = self.data.read().map_err(|e| format!("Lock error: {{}}", e))?;
        Ok(data.get(relation).and_then(|m| m.get(key).cloned()))
    }}

    pub fn put(&self, relation: &str, key: &str, value: Value) -> Result<(), Box<dyn std::error::Error>> {{
        let mut data = self.data.write().map_err(|e| format!("Lock error: {{}}", e))?;
        data.entry(relation.to_string()).or_default().insert(key.to_string(), value);
        Ok(())
    }}

    pub fn del(&self, relation: &str, key: &str) -> Result<(), Box<dyn std::error::Error>> {{
        let mut data = self.data.write().map_err(|e| format!("Lock error: {{}}", e))?;
        if let Some(m) = data.get_mut(relation) {{ m.remove(key); }}
        Ok(())
    }}
}}"#, name, pascal, pascal),
    };

    let test_content = format!(
        "// Tests for {} storage adapter\n#[cfg(test)]\nmod tests {{\n    use super::*;\n\n    #[test]\n    fn test_round_trip() {{\n        // TODO: Implement round-trip test\n    }}\n}}\n", name);

    vec![
        json!({"path": format!("storage/{}-adapter.rs", kebab), "content": adapter_content}),
        json!({"path": format!("storage/{}-adapter_test.rs", kebab), "content": test_content}),
    ]
}

#[async_trait]
impl StorageAdapterScaffoldGenHandler for StorageAdapterScaffoldGenHandlerImpl {
    async fn generate(
        &self,
        input: StorageAdapterScaffoldGenGenerateInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<StorageAdapterScaffoldGenGenerateOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(StorageAdapterScaffoldGenGenerateOutput::Error {
                message: "Adapter name is required".to_string(),
            });
        }

        let files = generate_adapter_files(&input.name, &input.backend);
        let count = files.len() as i64;

        Ok(StorageAdapterScaffoldGenGenerateOutput::Ok {
            files,
            files_generated: count,
        })
    }

    async fn preview(
        &self,
        input: StorageAdapterScaffoldGenPreviewInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<StorageAdapterScaffoldGenPreviewOutput, Box<dyn std::error::Error>> {
        if input.name.is_empty() {
            return Ok(StorageAdapterScaffoldGenPreviewOutput::Error {
                message: "Adapter name is required".to_string(),
            });
        }

        let files = generate_adapter_files(&input.name, &input.backend);
        let count = files.len() as i64;

        Ok(StorageAdapterScaffoldGenPreviewOutput::Ok {
            files,
            would_write: count,
            would_skip: 0,
        })
    }

    async fn register(
        &self,
        _input: StorageAdapterScaffoldGenRegisterInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<StorageAdapterScaffoldGenRegisterOutput, Box<dyn std::error::Error>> {
        Ok(StorageAdapterScaffoldGenRegisterOutput::Ok {
            name: "StorageAdapterScaffoldGen".to_string(),
            input_kind: "StorageConfig".to_string(),
            output_kind: "StorageAdapter".to_string(),
            capabilities: vec!["memory".to_string(), "sqlite".to_string(), "postgres".to_string(), "redis".to_string()],
        })
    }
}
