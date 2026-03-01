// DevServer Handler Implementation
//
// Coordinates the local development server lifecycle: start,
// stop, and query status. Delegates file watching to Resource
// and recompilation to syncs/Emitter.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DevServerHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let id = ID_COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("dev-server-{}", id)
}

pub struct DevServerHandlerImpl;

#[async_trait]
impl DevServerHandler for DevServerHandlerImpl {
    async fn start(
        &self,
        input: DevServerStartInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DevServerStartOutput, Box<dyn std::error::Error>> {
        // Check if port is already in use
        let existing = storage.find("dev-server", Some(&json!({ "port": input.port }))).await?;
        let running_on_port: Vec<_> = existing.iter()
            .filter(|r| r.get("status").and_then(|v| v.as_str()) == Some("running"))
            .collect();

        if !running_on_port.is_empty() {
            return Ok(DevServerStartOutput::PortInUse { port: input.port });
        }

        let id = next_id();
        let now = chrono::Utc::now().to_rfc3339();
        let url = format!("http://localhost:{}", input.port);

        storage.put("dev-server", &id, json!({
            "id": id,
            "port": input.port,
            "status": "running",
            "watchDirs": serde_json::to_string(&input.watch_dirs)?,
            "startedAt": now,
            "lastRecompile": now,
        })).await?;

        Ok(DevServerStartOutput::Ok {
            session: id,
            port: input.port,
            url,
        })
    }

    async fn stop(
        &self,
        input: DevServerStopInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DevServerStopOutput, Box<dyn std::error::Error>> {
        let record = storage.get("dev-server", &input.session).await?;
        if let Some(mut r) = record {
            r["status"] = json!("stopped");
            storage.put("dev-server", &input.session, r).await?;
        }

        Ok(DevServerStopOutput::Ok { session: input.session })
    }

    async fn status(
        &self,
        input: DevServerStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DevServerStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get("dev-server", &input.session).await?;
        match record {
            Some(r) if r.get("status").and_then(|v| v.as_str()) == Some("running") => {
                let started_at = r.get("startedAt").and_then(|v| v.as_str()).unwrap_or("");
                let uptime = if !started_at.is_empty() {
                    if let Ok(start) = chrono::DateTime::parse_from_rfc3339(started_at) {
                        let now = chrono::Utc::now();
                        (now.signed_duration_since(start)).num_seconds()
                    } else {
                        0
                    }
                } else {
                    0
                };

                Ok(DevServerStatusOutput::Running {
                    port: r.get("port").and_then(|v| v.as_i64()).unwrap_or(0),
                    uptime,
                    last_recompile: r.get("lastRecompile").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                })
            }
            _ => Ok(DevServerStatusOutput::Stopped),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_start_success() {
        let storage = InMemoryStorage::new();
        let handler = DevServerHandlerImpl;
        let result = handler.start(
            DevServerStartInput {
                port: 3000,
                watch_dirs: vec!["src".to_string()],
            },
            &storage,
        ).await.unwrap();
        match result {
            DevServerStartOutput::Ok { session, port, url } => {
                assert!(!session.is_empty());
                assert_eq!(port, 3000);
                assert!(url.contains("3000"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_stop() {
        let storage = InMemoryStorage::new();
        let handler = DevServerHandlerImpl;
        let start_result = handler.start(
            DevServerStartInput {
                port: 3001,
                watch_dirs: vec![],
            },
            &storage,
        ).await.unwrap();
        let session = match start_result {
            DevServerStartOutput::Ok { session, .. } => session,
            _ => panic!("Expected Ok"),
        };
        let result = handler.stop(
            DevServerStopInput { session: session.clone() },
            &storage,
        ).await.unwrap();
        match result {
            DevServerStopOutput::Ok { session: s } => {
                assert_eq!(s, session);
            },
        }
    }

    #[tokio::test]
    async fn test_status_stopped() {
        let storage = InMemoryStorage::new();
        let handler = DevServerHandlerImpl;
        let result = handler.status(
            DevServerStatusInput {
                session: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DevServerStatusOutput::Stopped => {},
            _ => panic!("Expected Stopped variant"),
        }
    }
}
