use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::RetentionPolicyHandler;
use serde_json::json;

pub struct RetentionPolicyHandlerImpl;

fn next_id(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}-{}-{}", prefix, t.as_secs(), t.subsec_nanos())
}

/// Convert retention period to milliseconds for comparison.
fn period_to_ms(period: i64, unit: &str) -> i64 {
    match unit {
        "seconds" => period * 1_000,
        "minutes" => period * 60 * 1_000,
        "hours" => period * 3_600 * 1_000,
        "days" => period * 86_400 * 1_000,
        "weeks" => period * 7 * 86_400 * 1_000,
        "months" => period * 30 * 86_400 * 1_000,
        "years" => period * 365 * 86_400 * 1_000,
        _ => period * 86_400 * 1_000,
    }
}

/// Check if a record identifier matches a hold scope pattern (glob-like).
fn matches_scope(record: &str, scope: &str) -> bool {
    let pattern = scope
        .replace('.', "\\.")
        .replace('*', ".*");
    regex_lite::Regex::new(&format!("^{}$", pattern))
        .map(|re| re.is_match(record))
        .unwrap_or_else(|_| record.starts_with(scope.trim_end_matches('*')))
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[async_trait]
impl RetentionPolicyHandler for RetentionPolicyHandlerImpl {
    async fn set_retention(
        &self,
        input: RetentionPolicySetRetentionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicySetRetentionOutput, Box<dyn std::error::Error>> {
        let existing = storage.find("retention-policy", Some(&json!({"recordType": input.record_type}))).await?;
        if !existing.is_empty() {
            return Ok(RetentionPolicySetRetentionOutput::AlreadyExists {
                message: format!("A policy already exists for record type '{}'", input.record_type),
            });
        }

        let policy_id = next_id("retention-policy");
        let now = now_iso();

        storage.put("retention-policy", &policy_id, json!({
            "id": policy_id,
            "recordType": input.record_type,
            "retentionPeriod": input.period,
            "unit": input.unit,
            "dispositionAction": input.disposition_action,
            "created": now
        })).await?;

        Ok(RetentionPolicySetRetentionOutput::Ok { policy_id })
    }

    async fn apply_hold(
        &self,
        input: RetentionPolicyApplyHoldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyApplyHoldOutput, Box<dyn std::error::Error>> {
        let hold_id = next_id("hold");
        let now = now_iso();

        storage.put("retention-hold", &hold_id, json!({
            "id": hold_id,
            "name": input.name,
            "scope": input.scope,
            "reason": input.reason,
            "issuer": input.issuer,
            "issued": now,
            "released": null
        })).await?;

        Ok(RetentionPolicyApplyHoldOutput::Ok {
            hold_id: json!(hold_id),
        })
    }

    async fn release_hold(
        &self,
        input: RetentionPolicyReleaseHoldInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyReleaseHoldOutput, Box<dyn std::error::Error>> {
        let hold_id_str = input.hold_id.as_str().unwrap_or("").to_string();
        let hold = storage.get("retention-hold", &hold_id_str).await?;

        if hold.is_none() {
            return Ok(RetentionPolicyReleaseHoldOutput::NotFound {
                message: format!("Hold '{}' not found", hold_id_str),
            });
        }

        let hold = hold.unwrap();
        if !hold.get("released").map_or(true, |v| v.is_null()) {
            return Ok(RetentionPolicyReleaseHoldOutput::AlreadyReleased {
                message: format!("Hold '{}' was already released", hold_id_str),
            });
        }

        let now = now_iso();
        let mut updated = hold.clone();
        updated["released"] = json!(now);
        updated["releasedBy"] = json!(input.released_by);
        updated["releaseReason"] = json!(input.reason);
        storage.put("retention-hold", &hold_id_str, updated).await?;

        Ok(RetentionPolicyReleaseHoldOutput::Ok)
    }

    async fn check_disposition(
        &self,
        input: RetentionPolicyCheckDispositionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyCheckDispositionOutput, Box<dyn std::error::Error>> {
        // Check for active holds
        let all_holds = storage.find("retention-hold", None).await?;
        let mut active_hold_names = Vec::new();
        for hold in &all_holds {
            let released = hold.get("released");
            if released.is_none() || released.unwrap().is_null() {
                let scope = hold.get("scope").and_then(|v| v.as_str()).unwrap_or("");
                if matches_scope(&input.record, scope) {
                    if let Some(name) = hold.get("name").and_then(|v| v.as_str()) {
                        active_hold_names.push(name.to_string());
                    }
                }
            }
        }

        if !active_hold_names.is_empty() {
            return Ok(RetentionPolicyCheckDispositionOutput::Held { hold_names: active_hold_names });
        }

        // Find matching policy
        let all_policies = storage.find("retention-policy", None).await?;
        let mut matching_policy = None;
        for policy in &all_policies {
            let record_type = policy.get("recordType").and_then(|v| v.as_str()).unwrap_or("");
            if input.record.starts_with(record_type) {
                matching_policy = Some(policy);
                break;
            }
        }

        if let Some(policy) = matching_policy {
            let period = policy.get("retentionPeriod").and_then(|v| v.as_i64()).unwrap_or(0);
            let unit = policy.get("unit").and_then(|v| v.as_str()).unwrap_or("days");
            let created_str = policy.get("created").and_then(|v| v.as_str()).unwrap_or("");

            if let Ok(created) = chrono::DateTime::parse_from_rfc3339(created_str) {
                let period_ms = period_to_ms(period, unit);
                let created_ms = created.timestamp_millis();
                let now_ms = now_millis();

                if now_ms - created_ms < period_ms {
                    let until_ms = created_ms + period_ms;
                    let until = chrono::DateTime::from_timestamp_millis(until_ms)
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_default();
                    let record_type = policy.get("recordType").and_then(|v| v.as_str()).unwrap_or("");
                    return Ok(RetentionPolicyCheckDispositionOutput::Retained {
                        reason: format!("Within retention period for '{}'", record_type),
                        until,
                    });
                }
            }

            let policy_id = policy.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            Ok(RetentionPolicyCheckDispositionOutput::Disposable { policy_id })
        } else {
            Ok(RetentionPolicyCheckDispositionOutput::Disposable {
                policy_id: String::new(),
            })
        }
    }

    async fn dispose(
        &self,
        input: RetentionPolicyDisposeInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyDisposeOutput, Box<dyn std::error::Error>> {
        // Check for active holds first
        let all_holds = storage.find("retention-hold", None).await?;
        let mut active_hold_names = Vec::new();
        for hold in &all_holds {
            let released = hold.get("released");
            if released.is_none() || released.unwrap().is_null() {
                let scope = hold.get("scope").and_then(|v| v.as_str()).unwrap_or("");
                if matches_scope(&input.record, scope) {
                    if let Some(name) = hold.get("name").and_then(|v| v.as_str()) {
                        active_hold_names.push(name.to_string());
                    }
                }
            }
        }

        if !active_hold_names.is_empty() {
            return Ok(RetentionPolicyDisposeOutput::Held { hold_names: active_hold_names });
        }

        // Check retention period
        let all_policies = storage.find("retention-policy", None).await?;
        let mut matching_policy = None;
        for policy in &all_policies {
            let record_type = policy.get("recordType").and_then(|v| v.as_str()).unwrap_or("");
            if input.record.starts_with(record_type) {
                matching_policy = Some(policy.clone());
                break;
            }
        }

        if let Some(policy) = &matching_policy {
            let period = policy.get("retentionPeriod").and_then(|v| v.as_i64()).unwrap_or(0);
            let unit = policy.get("unit").and_then(|v| v.as_str()).unwrap_or("days");
            let created_str = policy.get("created").and_then(|v| v.as_str()).unwrap_or("");

            if let Ok(created) = chrono::DateTime::parse_from_rfc3339(created_str) {
                let period_ms = period_to_ms(period, unit);
                if now_millis() - created.timestamp_millis() < period_ms {
                    let record_type = policy.get("recordType").and_then(|v| v.as_str()).unwrap_or("");
                    return Ok(RetentionPolicyDisposeOutput::Retained {
                        reason: format!("Retention period not yet elapsed for '{}'", record_type),
                    });
                }
            }
        }

        // Log disposition
        let log_id = next_id("disposition-log");
        let now = now_iso();
        let policy_id = matching_policy
            .as_ref()
            .and_then(|p| p.get("id").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();

        storage.put("retention-disposition-log", &log_id, json!({
            "id": log_id,
            "record": input.record,
            "policy": policy_id,
            "disposedAt": now,
            "disposedBy": input.disposed_by
        })).await?;

        Ok(RetentionPolicyDisposeOutput::Ok)
    }

    async fn audit_log(
        &self,
        input: RetentionPolicyAuditLogInput,
        storage: &dyn ConceptStorage,
    ) -> Result<RetentionPolicyAuditLogOutput, Box<dyn std::error::Error>> {
        let entries = if let Some(record) = &input.record {
            storage.find("retention-disposition-log", Some(&json!({"record": record}))).await?
        } else {
            storage.find("retention-disposition-log", None).await?
        };

        let formatted: Vec<serde_json::Value> = entries.iter().map(|e| {
            json!({
                "record": e.get("record").and_then(|v| v.as_str()).unwrap_or(""),
                "policy": e.get("policy").and_then(|v| v.as_str()).unwrap_or(""),
                "disposedAt": e.get("disposedAt").and_then(|v| v.as_str()).unwrap_or(""),
                "disposedBy": e.get("disposedBy").and_then(|v| v.as_str()).unwrap_or("")
            })
        }).collect();

        Ok(RetentionPolicyAuditLogOutput::Ok {
            entries: serde_json::to_string(&formatted)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_set_retention_success() {
        let storage = InMemoryStorage::new();
        let handler = RetentionPolicyHandlerImpl;
        let result = handler.set_retention(
            RetentionPolicySetRetentionInput {
                record_type: "audit-log".to_string(),
                period: 90,
                unit: "days".to_string(),
                disposition_action: "delete".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RetentionPolicySetRetentionOutput::Ok { policy_id } => {
                assert!(policy_id.starts_with("retention-policy-"));
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_set_retention_already_exists() {
        let storage = InMemoryStorage::new();
        let handler = RetentionPolicyHandlerImpl;
        handler.set_retention(
            RetentionPolicySetRetentionInput {
                record_type: "audit".to_string(), period: 30, unit: "days".to_string(),
                disposition_action: "delete".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.set_retention(
            RetentionPolicySetRetentionInput {
                record_type: "audit".to_string(), period: 60, unit: "days".to_string(),
                disposition_action: "archive".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RetentionPolicySetRetentionOutput::AlreadyExists { .. } => {},
            _ => panic!("Expected AlreadyExists variant"),
        }
    }

    #[tokio::test]
    async fn test_apply_hold() {
        let storage = InMemoryStorage::new();
        let handler = RetentionPolicyHandlerImpl;
        let result = handler.apply_hold(
            RetentionPolicyApplyHoldInput {
                name: "legal-hold-1".to_string(),
                scope: "audit*".to_string(),
                reason: "litigation".to_string(),
                issuer: "legal-team".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RetentionPolicyApplyHoldOutput::Ok { hold_id } => {
                assert!(!hold_id.is_null());
            },
        }
    }

    #[tokio::test]
    async fn test_release_hold_not_found() {
        let storage = InMemoryStorage::new();
        let handler = RetentionPolicyHandlerImpl;
        let result = handler.release_hold(
            RetentionPolicyReleaseHoldInput {
                hold_id: json!("nonexistent"),
                released_by: "admin".to_string(),
                reason: "resolved".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            RetentionPolicyReleaseHoldOutput::NotFound { .. } => {},
            _ => panic!("Expected NotFound variant"),
        }
    }

    #[tokio::test]
    async fn test_check_disposition_disposable() {
        let storage = InMemoryStorage::new();
        let handler = RetentionPolicyHandlerImpl;
        let result = handler.check_disposition(
            RetentionPolicyCheckDispositionInput { record: "some-record".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            RetentionPolicyCheckDispositionOutput::Disposable { .. } => {},
            _ => panic!("Expected Disposable variant"),
        }
    }

    #[tokio::test]
    async fn test_audit_log_empty() {
        let storage = InMemoryStorage::new();
        let handler = RetentionPolicyHandlerImpl;
        let result = handler.audit_log(
            RetentionPolicyAuditLogInput { record: None },
            &storage,
        ).await.unwrap();
        match result {
            RetentionPolicyAuditLogOutput::Ok { entries } => {
                assert_eq!(entries, "[]");
            },
        }
    }
}
