use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RuntimeHandler;
use serde_json::json;

pub struct RuntimeHandlerImpl;

fn next_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("runtime-{}-{}", t.as_secs(), t.subsec_nanos())
}

#[async_trait]
impl RuntimeHandler for RuntimeHandlerImpl {
    async fn provision(
        &self,
        input: RuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeProvisionOutput, Box<dyn std::error::Error>> {
        // Check if already provisioned
        let existing = storage.find("runtime-instance", Some(&json!({
            "concept": input.concept,
            "runtimeType": input.runtime_type
        }))).await?;

        if let Some(inst) = existing.first() {
            let instance = inst.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let endpoint = inst.get("endpoint").and_then(|v| v.as_str()).unwrap_or("").to_string();
            return Ok(RuntimeProvisionOutput::AlreadyProvisioned { instance, endpoint });
        }

        let instance_id = next_id();
        let endpoint = format!("https://{}.runtime.clef.dev/{}", input.runtime_type, input.concept);

        storage.put("runtime-instance", &instance_id, json!({
            "id": instance_id,
            "concept": input.concept,
            "runtimeType": input.runtime_type,
            "config": input.config,
            "endpoint": endpoint,
            "status": "provisioned",
            "version": null,
            "previousVersion": null,
            "trafficWeight": 100
        })).await?;

        Ok(RuntimeProvisionOutput::Ok { instance: instance_id, endpoint })
    }

    async fn deploy(
        &self,
        input: RuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeDeployOutput, Box<dyn std::error::Error>> {
        let record = storage.get("runtime-instance", &input.instance).await?;
        if record.is_none() {
            return Ok(RuntimeDeployOutput::DeployFailed {
                instance: input.instance,
                reason: "Instance not found".to_string(),
            });
        }

        let mut record = record.unwrap();
        let prev_version = record.get("version").and_then(|v| v.as_str()).map(String::from);

        record["previousVersion"] = json!(prev_version);
        record["version"] = json!(input.version);
        record["artifact"] = json!(input.artifact);
        record["status"] = json!("deployed");
        let endpoint = record.get("endpoint").and_then(|v| v.as_str()).unwrap_or("").to_string();

        storage.put("runtime-instance", &input.instance, record).await?;

        Ok(RuntimeDeployOutput::Ok { instance: input.instance, endpoint })
    }

    async fn set_traffic_weight(
        &self,
        input: RuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        if let Some(mut record) = storage.get("runtime-instance", &input.instance).await? {
            let clamped = input.weight.max(0).min(100);
            record["trafficWeight"] = json!(clamped);
            storage.put("runtime-instance", &input.instance, record).await?;

            Ok(RuntimeSetTrafficWeightOutput::Ok {
                instance: input.instance,
                new_weight: clamped,
            })
        } else {
            Ok(RuntimeSetTrafficWeightOutput::Ok {
                instance: input.instance,
                new_weight: 0,
            })
        }
    }

    async fn rollback(
        &self,
        input: RuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeRollbackOutput, Box<dyn std::error::Error>> {
        let record = storage.get("runtime-instance", &input.instance).await?;
        if record.is_none() {
            return Ok(RuntimeRollbackOutput::RollbackFailed {
                instance: input.instance,
                reason: "Instance not found".to_string(),
            });
        }

        let mut record = record.unwrap();
        let previous = record.get("previousVersion").and_then(|v| v.as_str()).map(String::from);

        if let Some(prev) = previous {
            let current = record.get("version").and_then(|v| v.as_str()).map(String::from);
            record["version"] = json!(prev);
            record["previousVersion"] = json!(current);
            record["status"] = json!("rolled-back");
            storage.put("runtime-instance", &input.instance, record).await?;

            Ok(RuntimeRollbackOutput::Ok {
                instance: input.instance,
                previous_version: prev,
            })
        } else {
            Ok(RuntimeRollbackOutput::NoHistory { instance: input.instance })
        }
    }

    async fn destroy(
        &self,
        input: RuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeDestroyOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("runtime-instance", &input.instance).await?;
        if existing.is_none() {
            return Ok(RuntimeDestroyOutput::DestroyFailed {
                instance: input.instance,
                reason: "Instance not found".to_string(),
            });
        }

        storage.del("runtime-instance", &input.instance).await?;
        Ok(RuntimeDestroyOutput::Ok { instance: input.instance })
    }

    async fn health_check(
        &self,
        input: RuntimeHealthCheckInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RuntimeHealthCheckOutput, Box<dyn std::error::Error>> {
        let record = storage.get("runtime-instance", &input.instance).await?;
        if record.is_none() {
            return Ok(RuntimeHealthCheckOutput::Unreachable { instance: input.instance });
        }

        let record = record.unwrap();
        let status = record.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");

        // Simulate latency check based on instance status
        let latency_ms = match status {
            "deployed" => 5,
            "provisioned" => 10,
            "rolled-back" => 15,
            _ => 100,
        };

        if latency_ms > 50 {
            Ok(RuntimeHealthCheckOutput::Degraded {
                instance: input.instance,
                latency_ms,
            })
        } else {
            Ok(RuntimeHealthCheckOutput::Ok {
                instance: input.instance,
                latency_ms,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_provision_success() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeHandlerImpl;
        let result = handler.provision(
            RuntimeProvisionInput {
                concept: "user".to_string(),
                runtime_type: "lambda".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeProvisionOutput::Ok { instance, endpoint } => {
                assert!(!instance.is_empty());
                assert!(endpoint.contains("lambda"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeHandlerImpl;
        let result = handler.deploy(
            RuntimeDeployInput {
                instance: "missing".to_string(),
                artifact: "art".to_string(),
                version: "v1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeDeployOutput::DeployFailed { .. } => {},
            _ => panic!("Expected DeployFailed"),
        }
    }

    #[tokio::test]
    async fn test_rollback_no_history() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeHandlerImpl;
        let prov = handler.provision(
            RuntimeProvisionInput { concept: "c".to_string(), runtime_type: "local".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let inst = match prov { RuntimeProvisionOutput::Ok { instance, .. } => instance, _ => panic!("") };
        let result = handler.rollback(
            RuntimeRollbackInput { instance: inst },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeRollbackOutput::NoHistory { .. } => {},
            _ => panic!("Expected NoHistory"),
        }
    }

    #[tokio::test]
    async fn test_destroy_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeHandlerImpl;
        let result = handler.destroy(
            RuntimeDestroyInput { instance: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeDestroyOutput::DestroyFailed { .. } => {},
            _ => panic!("Expected DestroyFailed"),
        }
    }

    #[tokio::test]
    async fn test_health_check_unreachable() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeHandlerImpl;
        let result = handler.health_check(
            RuntimeHealthCheckInput { instance: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeHealthCheckOutput::Unreachable { .. } => {},
            _ => panic!("Expected Unreachable"),
        }
    }

    #[tokio::test]
    async fn test_set_traffic_weight() {
        let storage = InMemoryStorage::new();
        let handler = RuntimeHandlerImpl;
        let prov = handler.provision(
            RuntimeProvisionInput { concept: "c".to_string(), runtime_type: "local".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        let inst = match prov { RuntimeProvisionOutput::Ok { instance, .. } => instance, _ => panic!("") };
        let result = handler.set_traffic_weight(
            RuntimeSetTrafficWeightInput { instance: inst, weight: 50 },
            &storage,
        ).await.unwrap();
        match result {
            RuntimeSetTrafficWeightOutput::Ok { new_weight, .. } => assert_eq!(new_weight, 50),
        }
    }
}
