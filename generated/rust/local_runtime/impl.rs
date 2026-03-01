// Local runtime implementation
// Manages local process deployments for development. Owns child
// process PIDs, port assignments, log file paths, and restart policies.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::LocalRuntimeHandler;
use serde_json::json;

pub struct LocalRuntimeHandlerImpl;

fn random_pid() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as i64;
    (seed % 50000) + 10000
}

#[async_trait]
impl LocalRuntimeHandler for LocalRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: LocalRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        // Check for port conflicts
        let existing_processes = storage.find("process", None).await?;
        for existing in &existing_processes {
            let port = existing.get("port").and_then(|v| v.as_i64()).unwrap_or(0);
            let status = existing.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if port == input.port && status == "running" {
                let existing_pid = existing.get("pid").and_then(|v| v.as_i64()).unwrap_or(0);
                return Ok(LocalRuntimeProvisionOutput::PortInUse {
                    port: input.port,
                    existing_pid,
                });
            }
        }

        let concept_lower = input.concept.to_lowercase();
        let now = chrono::Utc::now().timestamp_millis();
        let process_id = format!("local-{}-{}", concept_lower, now);
        let pid = random_pid();
        let endpoint = format!("http://localhost:{}", input.port);

        storage.put("process", &process_id, json!({
            "command": input.command,
            "workingDirectory": ".",
            "port": input.port,
            "envVars": "[]",
            "pid": pid,
            "status": "running",
            "logPath": format!("/tmp/logs/{}.log", concept_lower),
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(LocalRuntimeProvisionOutput::Ok {
            process: process_id,
            pid,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: LocalRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let new_pid = random_pid();

        if let Some(record) = storage.get("process", &input.process).await? {
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("command".into(), json!(input.command));
                obj.insert("pid".into(), json!(new_pid));
                obj.insert("status".into(), json!("running"));
                obj.insert("lastDeployedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
            }
            storage.put("process", &input.process, updated).await?;
        }

        Ok(LocalRuntimeDeployOutput::Ok {
            process: input.process,
            pid: new_pid,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: LocalRuntimeSetTrafficWeightInput,
        _storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        // Traffic weight has no effect locally; always 100
        let _ = input.weight;
        Ok(LocalRuntimeSetTrafficWeightOutput::Ok {
            process: input.process,
        })
    }

    async fn rollback(
        &self,
        input: LocalRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        let new_pid = random_pid();

        if let Some(record) = storage.get("process", &input.process).await? {
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("command".into(), json!(input.previous_command));
                obj.insert("pid".into(), json!(new_pid));
                obj.insert("status".into(), json!("running"));
                obj.insert("lastDeployedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
            }
            storage.put("process", &input.process, updated).await?;
        }

        Ok(LocalRuntimeRollbackOutput::Ok {
            process: input.process,
            pid: new_pid,
        })
    }

    async fn destroy(
        &self,
        input: LocalRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LocalRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("process", &input.process).await? {
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("pid".into(), json!(null));
                obj.insert("status".into(), json!("stopped"));
            }
            storage.put("process", &input.process, updated).await?;
        }
        storage.del("process", &input.process).await?;

        Ok(LocalRuntimeDestroyOutput::Ok {
            process: input.process,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_provision_success() {
        let storage = InMemoryStorage::new();
        let handler = LocalRuntimeHandlerImpl;
        let result = handler.provision(
            LocalRuntimeProvisionInput {
                concept: "DevServer".into(),
                command: "npm start".into(),
                port: 3000,
            },
            &storage,
        ).await.unwrap();
        match result {
            LocalRuntimeProvisionOutput::Ok { process, pid, endpoint } => {
                assert!(process.contains("local-devserver"));
                assert!(pid > 0);
                assert_eq!(endpoint, "http://localhost:3000");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy() {
        let storage = InMemoryStorage::new();
        let handler = LocalRuntimeHandlerImpl;
        let result = handler.deploy(
            LocalRuntimeDeployInput {
                process: "proc-1".into(),
                command: "npm run dev".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LocalRuntimeDeployOutput::Ok { process, pid } => {
                assert_eq!(process, "proc-1");
                assert!(pid > 0);
            }
        }
    }

    #[tokio::test]
    async fn test_set_traffic_weight() {
        let storage = InMemoryStorage::new();
        let handler = LocalRuntimeHandlerImpl;
        let result = handler.set_traffic_weight(
            LocalRuntimeSetTrafficWeightInput { process: "proc-1".into(), weight: 100 },
            &storage,
        ).await.unwrap();
        match result {
            LocalRuntimeSetTrafficWeightOutput::Ok { process } => assert_eq!(process, "proc-1"),
        }
    }

    #[tokio::test]
    async fn test_rollback() {
        let storage = InMemoryStorage::new();
        let handler = LocalRuntimeHandlerImpl;
        let result = handler.rollback(
            LocalRuntimeRollbackInput { process: "proc-1".into(), previous_command: "npm start".into() },
            &storage,
        ).await.unwrap();
        match result {
            LocalRuntimeRollbackOutput::Ok { process, pid } => {
                assert_eq!(process, "proc-1");
                assert!(pid > 0);
            }
        }
    }

    #[tokio::test]
    async fn test_destroy() {
        let storage = InMemoryStorage::new();
        let handler = LocalRuntimeHandlerImpl;
        let result = handler.destroy(
            LocalRuntimeDestroyInput { process: "proc-1".into() },
            &storage,
        ).await.unwrap();
        match result {
            LocalRuntimeDestroyOutput::Ok { process } => assert_eq!(process, "proc-1"),
        }
    }
}
