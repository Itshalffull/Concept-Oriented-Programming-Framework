// ============================================================
// ConceptStorage — Rust storage trait + in-memory implementation
//
// Mirrors the TypeScript ConceptStorage interface from the kernel.
// Each concept handler receives &dyn ConceptStorage.
// ============================================================

use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;

/// Result type alias for storage operations.
pub type StorageResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

/// Storage interface matching the Clef kernel's ConceptStorage.
#[async_trait]
pub trait ConceptStorage: Send + Sync {
    async fn put(&self, relation: &str, key: &str, value: Value) -> StorageResult<()>;
    async fn get(&self, relation: &str, key: &str) -> StorageResult<Option<Value>>;
    async fn find(&self, relation: &str, criteria: Option<&Value>) -> StorageResult<Vec<Value>>;
    async fn del(&self, relation: &str, key: &str) -> StorageResult<()>;
    async fn del_many(&self, relation: &str, criteria: &Value) -> StorageResult<u64>;
}

/// In-memory storage for testing. Thread-safe via Mutex.
pub struct InMemoryStorage {
    data: Mutex<HashMap<String, HashMap<String, Value>>>,
}

impl InMemoryStorage {
    pub fn new() -> Self {
        Self {
            data: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for InMemoryStorage {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ConceptStorage for InMemoryStorage {
    async fn put(&self, relation: &str, key: &str, value: Value) -> StorageResult<()> {
        let mut data = self.data.lock().unwrap();
        let rel = data.entry(relation.to_string()).or_default();
        rel.insert(key.to_string(), value);
        Ok(())
    }

    async fn get(&self, relation: &str, key: &str) -> StorageResult<Option<Value>> {
        let data = self.data.lock().unwrap();
        Ok(data
            .get(relation)
            .and_then(|rel| rel.get(key))
            .cloned())
    }

    async fn find(&self, relation: &str, criteria: Option<&Value>) -> StorageResult<Vec<Value>> {
        let data = self.data.lock().unwrap();
        let Some(rel) = data.get(relation) else {
            return Ok(vec![]);
        };

        let entries: Vec<Value> = rel.values().cloned().collect();

        match criteria {
            None => Ok(entries),
            Some(crit) => {
                let crit_obj = crit.as_object();
                Ok(entries
                    .into_iter()
                    .filter(|entry| {
                        if let (Some(co), Some(eo)) = (crit_obj, entry.as_object()) {
                            co.iter().all(|(k, v)| eo.get(k) == Some(v))
                        } else {
                            false
                        }
                    })
                    .collect())
            }
        }
    }

    async fn del(&self, relation: &str, key: &str) -> StorageResult<()> {
        let mut data = self.data.lock().unwrap();
        if let Some(rel) = data.get_mut(relation) {
            rel.remove(key);
        }
        Ok(())
    }

    async fn del_many(&self, relation: &str, criteria: &Value) -> StorageResult<u64> {
        let mut data = self.data.lock().unwrap();
        let Some(rel) = data.get_mut(relation) else {
            return Ok(0);
        };

        let crit_obj = criteria.as_object();
        let keys_to_remove: Vec<String> = rel
            .iter()
            .filter(|(_, v)| {
                if let (Some(co), Some(eo)) = (crit_obj, v.as_object()) {
                    co.iter().all(|(k, cv)| eo.get(k) == Some(cv))
                } else {
                    false
                }
            })
            .map(|(k, _)| k.clone())
            .collect();

        let count = keys_to_remove.len() as u64;
        for k in keys_to_remove {
            rel.remove(&k);
        }
        Ok(count)
    }
}
