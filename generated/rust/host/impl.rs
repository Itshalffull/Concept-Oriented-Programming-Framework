// Host concept implementation
// Concept mounting into UI views with lifecycle management: mount, ready, resource tracking,
// unmount, refresh, and error state handling.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::HostHandler;
use serde_json::json;
use std::collections::HashSet;
use chrono::Utc;

pub struct HostHandlerImpl;

#[async_trait]
impl HostHandler for HostHandlerImpl {
    async fn mount(
        &self,
        input: HostMountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostMountOutput, Box<dyn std::error::Error>> {
        // Validate level range (0-99 supported nesting levels)
        if input.level < 0 || input.level > 99 {
            return Ok(HostMountOutput::Invalid {
                message: format!("Level {} is out of valid range 0-99", input.level),
            });
        }

        if input.concept.trim().is_empty() || input.view.trim().is_empty() {
            return Ok(HostMountOutput::Invalid {
                message: "Concept and view must not be empty".to_string(),
            });
        }

        let zone = input.zone.unwrap_or_else(|| "default".to_string());

        storage.put("host", &input.host, json!({
            "host": input.host,
            "concept": input.concept,
            "view": input.view,
            "level": input.level,
            "zone": zone,
            "status": "mounting",
            "machines": "[]",
            "resources": "[]",
            "mountedAt": Utc::now().to_rfc3339(),
        })).await?;

        Ok(HostMountOutput::Ok { host: input.host })
    }

    async fn ready(
        &self,
        input: HostReadyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostReadyOutput, Box<dyn std::error::Error>> {
        let record = storage.get("host", &input.host).await?;
        let Some(mut host_data) = record else {
            return Ok(HostReadyOutput::Invalid {
                message: format!("Host {} not found", input.host),
            });
        };

        let current_status = host_data.get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if current_status != "mounting" && current_status != "refreshing" {
            return Ok(HostReadyOutput::Invalid {
                message: format!("Host {} is in state {} and cannot transition to ready", input.host, current_status),
            });
        }

        host_data["status"] = json!("ready");
        host_data["readyAt"] = json!(Utc::now().to_rfc3339());
        storage.put("host", &input.host, host_data).await?;

        Ok(HostReadyOutput::Ok { host: input.host })
    }

    async fn track_resource(
        &self,
        input: HostTrackResourceInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostTrackResourceOutput, Box<dyn std::error::Error>> {
        let record = storage.get("host", &input.host).await?;
        let Some(mut host_data) = record else {
            return Ok(HostTrackResourceOutput::Notfound {
                message: format!("Host {} not found", input.host),
            });
        };

        let mut resources: Vec<serde_json::Value> = host_data.get("resources")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        resources.push(json!({
            "kind": input.kind,
            "ref": input.r#ref,
            "trackedAt": Utc::now().to_rfc3339(),
        }));

        host_data["resources"] = json!(serde_json::to_string(&resources)?);
        storage.put("host", &input.host, host_data).await?;

        Ok(HostTrackResourceOutput::Ok { host: input.host })
    }

    async fn unmount(
        &self,
        input: HostUnmountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostUnmountOutput, Box<dyn std::error::Error>> {
        let record = storage.get("host", &input.host).await?;
        let Some(host_data) = record else {
            return Ok(HostUnmountOutput::Notfound {
                message: format!("Host {} not found", input.host),
            });
        };

        // Collect machines for cleanup
        let machines: HashSet<String> = host_data.get("machines")
            .and_then(|v| v.as_str())
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        // Collect binding reference if any
        let binding = host_data.get("binding")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Remove the host entry
        storage.del("host", &input.host).await?;

        Ok(HostUnmountOutput::Ok {
            host: input.host,
            machines,
            binding,
        })
    }

    async fn refresh(
        &self,
        input: HostRefreshInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostRefreshOutput, Box<dyn std::error::Error>> {
        let record = storage.get("host", &input.host).await?;
        let Some(mut host_data) = record else {
            return Ok(HostRefreshOutput::Notfound {
                message: format!("Host {} not found", input.host),
            });
        };

        let current_status = host_data.get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if current_status == "error" {
            return Ok(HostRefreshOutput::Invalid {
                message: format!("Host {} is in error state; clear error before refreshing", input.host),
            });
        }

        host_data["status"] = json!("refreshing");
        host_data["refreshedAt"] = json!(Utc::now().to_rfc3339());

        // Clear tracked resources for re-acquisition
        host_data["resources"] = json!("[]");

        storage.put("host", &input.host, host_data).await?;

        Ok(HostRefreshOutput::Ok { host: input.host })
    }

    async fn set_error(
        &self,
        input: HostSetErrorInput,
        storage: &dyn ConceptStorage,
    ) -> Result<HostSetErrorOutput, Box<dyn std::error::Error>> {
        let record = storage.get("host", &input.host).await?;
        let Some(mut host_data) = record else {
            return Ok(HostSetErrorOutput::Notfound {
                message: format!("Host {} not found", input.host),
            });
        };

        host_data["status"] = json!("error");
        host_data["errorInfo"] = json!(input.error_info);
        host_data["errorAt"] = json!(Utc::now().to_rfc3339());
        storage.put("host", &input.host, host_data).await?;

        Ok(HostSetErrorOutput::Ok { host: input.host })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_mount_success() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.mount(
            HostMountInput {
                host: "host-1".to_string(),
                concept: "user".to_string(),
                view: "profile-card".to_string(),
                level: 0,
                zone: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            HostMountOutput::Ok { host } => {
                assert_eq!(host, "host-1");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_mount_invalid_level() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.mount(
            HostMountInput {
                host: "host-bad".to_string(),
                concept: "user".to_string(),
                view: "card".to_string(),
                level: 100,
                zone: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            HostMountOutput::Invalid { message } => {
                assert!(message.contains("out of valid range"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_mount_empty_concept() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.mount(
            HostMountInput {
                host: "host-2".to_string(),
                concept: "".to_string(),
                view: "card".to_string(),
                level: 0,
                zone: None,
            },
            &storage,
        ).await.unwrap();
        match result {
            HostMountOutput::Invalid { message } => {
                assert!(message.contains("must not be empty"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_ready_success() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        handler.mount(
            HostMountInput {
                host: "host-r".to_string(),
                concept: "user".to_string(),
                view: "card".to_string(),
                level: 0,
                zone: None,
            },
            &storage,
        ).await.unwrap();
        let result = handler.ready(
            HostReadyInput { host: "host-r".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            HostReadyOutput::Ok { host } => {
                assert_eq!(host, "host-r");
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_ready_not_found() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.ready(
            HostReadyInput { host: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            HostReadyOutput::Invalid { message } => {
                assert!(message.contains("not found"));
            },
            _ => panic!("Expected Invalid variant"),
        }
    }

    #[tokio::test]
    async fn test_track_resource_notfound() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.track_resource(
            HostTrackResourceInput {
                host: "missing".to_string(),
                kind: "timer".to_string(),
                r#ref: "t-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HostTrackResourceOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_unmount_notfound() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.unmount(
            HostUnmountInput { host: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            HostUnmountOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_refresh_notfound() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.refresh(
            HostRefreshInput { host: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            HostRefreshOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_set_error_notfound() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        let result = handler.set_error(
            HostSetErrorInput {
                host: "missing".to_string(),
                error_info: "something broke".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            HostSetErrorOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_mount_ready_refresh_lifecycle() {
        let storage = InMemoryStorage::new();
        let handler = HostHandlerImpl;
        // Mount
        handler.mount(
            HostMountInput {
                host: "h-life".to_string(),
                concept: "article".to_string(),
                view: "detail".to_string(),
                level: 1,
                zone: Some("main".to_string()),
            },
            &storage,
        ).await.unwrap();
        // Ready
        handler.ready(
            HostReadyInput { host: "h-life".to_string() },
            &storage,
        ).await.unwrap();
        // Refresh
        let result = handler.refresh(
            HostRefreshInput { host: "h-life".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            HostRefreshOutput::Ok { host } => {
                assert_eq!(host, "h-life");
            },
            _ => panic!("Expected Ok variant"),
        }
    }
}
