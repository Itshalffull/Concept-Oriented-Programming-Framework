// Migration implementation
// Orchestrates storage schema migrations using the expand/contract
// pattern. Plans migration steps, expands schema, migrates data,
// contracts old schema, and tracks progress.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::MigrationHandler;
use serde_json::json;

pub struct MigrationHandlerImpl;

#[async_trait]
impl MigrationHandler for MigrationHandlerImpl {
    async fn plan(
        &self,
        input: MigrationPlanInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationPlanOutput, Box<dyn std::error::Error>> {
        if input.from_version == input.to_version {
            return Ok(MigrationPlanOutput::NoMigrationNeeded {
                concept: input.concept,
            });
        }

        if input.to_version < input.from_version {
            return Ok(MigrationPlanOutput::Incompatible {
                concept: input.concept.clone(),
                reason: format!(
                    "Cannot migrate backwards from v{} to v{}",
                    input.from_version, input.to_version
                ),
            });
        }

        let now = chrono::Utc::now().timestamp_millis();
        let migration_id = format!("mig-{}-{}-{}-{}", input.concept, input.from_version, input.to_version, now);

        let mut steps = Vec::new();
        for v in input.from_version..input.to_version {
            steps.push(format!("expand-v{}-to-v{}", v, v + 1));
            steps.push(format!("migrate-v{}-to-v{}", v, v + 1));
            steps.push(format!("contract-v{}-to-v{}", v, v + 1));
        }

        let estimated_records = 1000i64;

        storage.put("migration", &migration_id, json!({
            "migrationId": migration_id,
            "concept": input.concept,
            "fromVersion": input.from_version,
            "toVersion": input.to_version,
            "phase": "planned",
            "recordsMigrated": 0,
            "recordsTotal": estimated_records,
            "startedAt": chrono::Utc::now().to_rfc3339(),
            "errors": "[]",
        })).await?;

        Ok(MigrationPlanOutput::Ok {
            migration: migration_id,
            steps: serde_json::to_string(&steps)?,
            estimated_records,
        })
    }

    async fn expand(
        &self,
        input: MigrationExpandInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationExpandOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("migration", &input.migration).await? {
            Some(r) => r,
            None => return Ok(MigrationExpandOutput::Failed {
                migration: input.migration,
                reason: "Migration not found".into(),
            }),
        };

        let phase = existing.get("phase").and_then(|v| v.as_str()).unwrap_or("");
        if phase != "planned" {
            return Ok(MigrationExpandOutput::Failed {
                migration: input.migration,
                reason: format!("Cannot expand from phase: {}", phase),
            });
        }

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("phase".into(), json!("expanded"));
        }
        storage.put("migration", &input.migration, updated).await?;

        Ok(MigrationExpandOutput::Ok { migration: input.migration })
    }

    async fn migrate(
        &self,
        input: MigrationMigrateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationMigrateOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("migration", &input.migration).await? {
            Some(r) => r,
            None => return Ok(MigrationMigrateOutput::Partial {
                migration: input.migration,
                migrated: 0,
                failed: 0,
                errors: vec!["Migration not found".into()],
            }),
        };

        let phase = existing.get("phase").and_then(|v| v.as_str()).unwrap_or("");
        if phase != "expanded" {
            return Ok(MigrationMigrateOutput::Partial {
                migration: input.migration,
                migrated: 0,
                failed: 0,
                errors: vec![format!("Cannot migrate from phase: {}", phase)],
            });
        }

        let records_total = existing.get("recordsTotal")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("phase".into(), json!("migrated"));
            obj.insert("recordsMigrated".into(), json!(records_total));
        }
        storage.put("migration", &input.migration, updated).await?;

        Ok(MigrationMigrateOutput::Ok {
            migration: input.migration,
            records_migrated: records_total,
        })
    }

    async fn contract(
        &self,
        input: MigrationContractInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationContractOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("migration", &input.migration).await? {
            Some(r) => r,
            None => return Ok(MigrationContractOutput::Rollback {
                migration: input.migration,
            }),
        };

        let phase = existing.get("phase").and_then(|v| v.as_str()).unwrap_or("");
        if phase != "migrated" {
            return Ok(MigrationContractOutput::Rollback {
                migration: input.migration,
            });
        }

        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("phase".into(), json!("completed"));
        }
        storage.put("migration", &input.migration, updated).await?;

        Ok(MigrationContractOutput::Ok { migration: input.migration })
    }

    async fn status(
        &self,
        input: MigrationStatusInput,
        storage: &dyn ConceptStorage,
    ) -> Result<MigrationStatusOutput, Box<dyn std::error::Error>> {
        let existing = match storage.get("migration", &input.migration).await? {
            Some(r) => r,
            None => return Ok(MigrationStatusOutput::Ok {
                migration: input.migration,
                phase: "unknown".into(),
                progress: 0.0,
            }),
        };

        let records_total = existing.get("recordsTotal")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let records_migrated = existing.get("recordsMigrated")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let progress = if records_total > 0.0 { records_migrated / records_total } else { 0.0 };

        let phase = existing.get("phase")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(MigrationStatusOutput::Ok {
            migration: input.migration,
            phase,
            progress,
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
        let handler = MigrationHandlerImpl;
        let result = handler.plan(
            MigrationPlanInput { concept: "User".into(), from_version: 1, to_version: 3 },
            &storage,
        ).await.unwrap();
        match result {
            MigrationPlanOutput::Ok { migration, steps, estimated_records } => {
                assert!(migration.contains("mig-User"));
                let parsed_steps: Vec<String> = serde_json::from_str(&steps).unwrap();
                assert!(!parsed_steps.is_empty());
                assert!(estimated_records > 0);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_plan_no_migration_needed() {
        let storage = InMemoryStorage::new();
        let handler = MigrationHandlerImpl;
        let result = handler.plan(
            MigrationPlanInput { concept: "User".into(), from_version: 2, to_version: 2 },
            &storage,
        ).await.unwrap();
        match result {
            MigrationPlanOutput::NoMigrationNeeded { .. } => {}
            _ => panic!("Expected NoMigrationNeeded variant"),
        }
    }

    #[tokio::test]
    async fn test_plan_incompatible() {
        let storage = InMemoryStorage::new();
        let handler = MigrationHandlerImpl;
        let result = handler.plan(
            MigrationPlanInput { concept: "User".into(), from_version: 3, to_version: 1 },
            &storage,
        ).await.unwrap();
        match result {
            MigrationPlanOutput::Incompatible { .. } => {}
            _ => panic!("Expected Incompatible variant"),
        }
    }

    #[tokio::test]
    async fn test_expand_success() {
        let storage = InMemoryStorage::new();
        let handler = MigrationHandlerImpl;
        let plan_result = handler.plan(
            MigrationPlanInput { concept: "X".into(), from_version: 1, to_version: 2 },
            &storage,
        ).await.unwrap();
        let mig_id = match plan_result {
            MigrationPlanOutput::Ok { migration, .. } => migration,
            _ => panic!("Expected Ok"),
        };
        let result = handler.expand(
            MigrationExpandInput { migration: mig_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            MigrationExpandOutput::Ok { migration } => assert_eq!(migration, mig_id),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_expand_not_found() {
        let storage = InMemoryStorage::new();
        let handler = MigrationHandlerImpl;
        let result = handler.expand(
            MigrationExpandInput { migration: "nonexistent".into() },
            &storage,
        ).await.unwrap();
        match result {
            MigrationExpandOutput::Failed { .. } => {}
            _ => panic!("Expected Failed variant"),
        }
    }

    #[tokio::test]
    async fn test_status_unknown() {
        let storage = InMemoryStorage::new();
        let handler = MigrationHandlerImpl;
        let result = handler.status(
            MigrationStatusInput { migration: "unknown".into() },
            &storage,
        ).await.unwrap();
        match result {
            MigrationStatusOutput::Ok { phase, .. } => assert_eq!(phase, "unknown"),
        }
    }
}
