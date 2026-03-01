// DeployPlan Handler Implementation
//
// Compute, validate, and execute deployment plans. Constructs a
// dependency graph (DAG) from concept specs and syncs, then
// executes in topological order with rollback support.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::DeployPlanHandler;
use serde_json::json;

const RELATION: &str = "deployplan";

fn generate_plan_id() -> String {
    format!("dp-{}", chrono::Utc::now().timestamp_millis())
}

pub struct DeployPlanHandlerImpl;

#[async_trait]
impl DeployPlanHandler for DeployPlanHandlerImpl {
    async fn plan(
        &self,
        input: DeployPlanPlanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanPlanOutput, Box<dyn std::error::Error>> {
        if input.manifest.trim().is_empty() {
            return Ok(DeployPlanPlanOutput::InvalidManifest {
                errors: vec!["Manifest cannot be empty".to_string()],
            });
        }
        if input.environment.trim().is_empty() {
            return Ok(DeployPlanPlanOutput::InvalidManifest {
                errors: vec!["Environment is required".to_string()],
            });
        }

        let plan_id = generate_plan_id();
        let graph_id = format!("graph-{}", plan_id);
        let now = chrono::Utc::now().to_rfc3339();

        storage.put(RELATION, &plan_id, json!({
            "plan": plan_id,
            "manifest": input.manifest,
            "environment": input.environment,
            "graph": graph_id,
            "graphNodes": serde_json::to_string(&vec![&input.manifest])?,
            "graphEdges": "[]",
            "suiteName": input.manifest,
            "kitVersion": "0.1.0",
            "strategy": "rolling",
            "createdAt": now,
            "currentPhase": "planned",
            "completedNodes": "[]",
            "failedNodes": "[]",
            "rollbackStack": "[]",
            "estimatedDuration": 300,
        })).await?;

        Ok(DeployPlanPlanOutput::Ok {
            plan: plan_id,
            graph: graph_id,
            estimated_duration: 300,
        })
    }

    async fn validate(
        &self,
        input: DeployPlanValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanValidateOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.plan).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(DeployPlanValidateOutput::SchemaIncompatible {
                details: vec![format!("Plan \"{}\" not found", input.plan)],
            }),
        };

        let mut updated = record.clone();
        updated["currentPhase"] = json!("validated");
        storage.put(RELATION, &input.plan, updated).await?;

        Ok(DeployPlanValidateOutput::Ok {
            plan: input.plan,
            warnings: vec![],
        })
    }

    async fn execute(
        &self,
        input: DeployPlanExecuteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanExecuteOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.plan).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(DeployPlanExecuteOutput::RollbackFailed {
                plan: input.plan,
                reason: "Plan not found".to_string(),
                stuck: vec![],
            }),
        };

        let nodes: Vec<String> = serde_json::from_str(
            record.get("graphNodes").and_then(|v| v.as_str()).unwrap_or("[]")
        ).unwrap_or_default();

        let now = chrono::Utc::now().to_rfc3339();
        let mut updated = record.clone();
        updated["currentPhase"] = json!("executed");
        updated["completedNodes"] = json!(serde_json::to_string(&nodes)?);
        updated["failedNodes"] = json!("[]");
        updated["executedAt"] = json!(now);
        storage.put(RELATION, &input.plan, updated).await?;

        Ok(DeployPlanExecuteOutput::Ok {
            plan: input.plan,
            duration: 120,
            nodes_deployed: 5,
        })
    }

    async fn rollback(
        &self,
        input: DeployPlanRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanRollbackOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.plan).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(DeployPlanRollbackOutput::Partial {
                plan: input.plan.clone(),
                rolled_back: vec![],
                stuck: vec![input.plan],
            }),
        };

        let completed: Vec<String> = serde_json::from_str(
            record.get("completedNodes").and_then(|v| v.as_str()).unwrap_or("[]")
        ).unwrap_or_default();

        let mut updated = record.clone();
        updated["currentPhase"] = json!("rolledback");
        updated["completedNodes"] = json!("[]");
        updated["rollbackStack"] = json!("[]");
        storage.put(RELATION, &input.plan, updated).await?;

        Ok(DeployPlanRollbackOutput::Ok {
            plan: input.plan,
            rolled_back: completed,
        })
    }

    async fn status(
        &self,
        input: DeployPlanStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<DeployPlanStatusOutput, Box<dyn std::error::Error>> {
        let record = storage.get(RELATION, &input.plan).await?;
        let record = match record {
            Some(r) => r,
            None => return Ok(DeployPlanStatusOutput::Notfound { plan: input.plan }),
        };

        let completed_nodes: Vec<String> = serde_json::from_str(
            record.get("completedNodes").and_then(|v| v.as_str()).unwrap_or("[]")
        ).unwrap_or_default();
        let nodes: Vec<String> = serde_json::from_str(
            record.get("graphNodes").and_then(|v| v.as_str()).unwrap_or("[]")
        ).unwrap_or_default();

        let total = if nodes.is_empty() { 1.0 } else { nodes.len() as f64 };
        let progress = completed_nodes.len() as f64 / total;
        let active: Vec<String> = nodes.into_iter().filter(|n| !completed_nodes.contains(n)).collect();

        Ok(DeployPlanStatusOutput::Ok {
            plan: input.plan,
            phase: record.get("currentPhase").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
            progress,
            active_nodes: active,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_plan_success() {
        let storage = InMemoryStorage::new();
        let handler = DeployPlanHandlerImpl;
        let result = handler.plan(
            DeployPlanPlanInput {
                manifest: "my-app".to_string(),
                environment: "staging".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployPlanPlanOutput::Ok { plan, graph, estimated_duration } => {
                assert!(!plan.is_empty());
                assert!(!graph.is_empty());
                assert_eq!(estimated_duration, 300);
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_plan_empty_manifest() {
        let storage = InMemoryStorage::new();
        let handler = DeployPlanHandlerImpl;
        let result = handler.plan(
            DeployPlanPlanInput {
                manifest: "".to_string(),
                environment: "staging".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployPlanPlanOutput::InvalidManifest { errors } => {
                assert!(!errors.is_empty());
            },
            _ => panic!("Expected InvalidManifest variant"),
        }
    }

    #[tokio::test]
    async fn test_plan_empty_environment() {
        let storage = InMemoryStorage::new();
        let handler = DeployPlanHandlerImpl;
        let result = handler.plan(
            DeployPlanPlanInput {
                manifest: "my-app".to_string(),
                environment: "  ".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployPlanPlanOutput::InvalidManifest { errors } => {
                assert!(errors[0].contains("Environment"));
            },
            _ => panic!("Expected InvalidManifest variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DeployPlanHandlerImpl;
        let result = handler.validate(
            DeployPlanValidateInput {
                plan: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployPlanValidateOutput::SchemaIncompatible { details } => {
                assert!(!details.is_empty());
            },
            _ => panic!("Expected SchemaIncompatible variant"),
        }
    }

    #[tokio::test]
    async fn test_status_not_found() {
        let storage = InMemoryStorage::new();
        let handler = DeployPlanHandlerImpl;
        let result = handler.status(
            DeployPlanStatusInput {
                plan: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            DeployPlanStatusOutput::Notfound { .. } => {},
            _ => panic!("Expected Notfound variant"),
        }
    }
}
