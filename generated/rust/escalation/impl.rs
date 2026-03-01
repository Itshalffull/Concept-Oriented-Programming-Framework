// Escalation concept implementation
// Manages escalation workflows with levels: escalated -> accepted -> resolved,
// with re-escalation support that increments the escalation level.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::EscalationHandler;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn next_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst) + 1;
    format!("esc-{}", n)
}

pub struct EscalationHandlerImpl;

#[async_trait]
impl EscalationHandler for EscalationHandlerImpl {
    async fn escalate(
        &self,
        input: EscalationEscalateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationEscalateOutput, Box<dyn std::error::Error>> {
        if input.subject.is_empty() || input.reason.is_empty() {
            return Ok(EscalationEscalateOutput::ValidationError {
                message: "Subject and reason must not be empty".to_string(),
            });
        }

        let escalation_id = next_id();
        let level: i64 = 1;

        storage.put("escalation", &escalation_id, json!({
            "escalationId": escalation_id,
            "subject": input.subject,
            "reason": input.reason,
            "escalatedBy": input.escalated_by,
            "assignedTo": input.escalate_to,
            "severity": input.severity,
            "context": input.context,
            "status": "escalated",
            "level": level,
            "history": serde_json::to_string(&vec![json!({
                "action": "escalated",
                "by": input.escalated_by,
                "to": input.escalate_to,
                "reason": input.reason,
                "level": level,
                "timestamp": chrono::Utc::now().to_rfc3339(),
            })])?,
            "createdAt": chrono::Utc::now().to_rfc3339(),
            "updatedAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(EscalationEscalateOutput::Ok {
            escalation_id,
            status: "escalated".to_string(),
            level,
        })
    }

    async fn accept(
        &self,
        input: EscalationAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationAcceptOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("escalation", &input.escalation_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(EscalationAcceptOutput::NotFound {
                escalation_id: input.escalation_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "escalated" {
            return Ok(EscalationAcceptOutput::InvalidState {
                escalation_id: input.escalation_id,
                current_status: status.to_string(),
            });
        }

        let assigned_to = record["assignedTo"].as_str().unwrap_or("");
        if assigned_to != input.accepted_by {
            return Ok(EscalationAcceptOutput::NotAssigned {
                escalation_id: input.escalation_id,
                message: format!("Only the assigned party '{}' can accept this escalation", assigned_to),
            });
        }

        let mut history: Vec<serde_json::Value> = serde_json::from_str(
            record["history"].as_str().unwrap_or("[]")
        )?;
        history.push(json!({
            "action": "accepted",
            "by": input.accepted_by,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

        let mut updated = record.clone();
        updated["status"] = json!("accepted");
        updated["history"] = json!(serde_json::to_string(&history)?);
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("escalation", &input.escalation_id, updated).await?;

        Ok(EscalationAcceptOutput::Ok {
            escalation_id: input.escalation_id,
            status: "accepted".to_string(),
        })
    }

    async fn resolve(
        &self,
        input: EscalationResolveInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationResolveOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("escalation", &input.escalation_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(EscalationResolveOutput::NotFound {
                escalation_id: input.escalation_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "accepted" {
            return Ok(EscalationResolveOutput::InvalidState {
                escalation_id: input.escalation_id,
                current_status: status.to_string(),
            });
        }

        let mut history: Vec<serde_json::Value> = serde_json::from_str(
            record["history"].as_str().unwrap_or("[]")
        )?;
        history.push(json!({
            "action": "resolved",
            "by": input.resolved_by,
            "resolution": input.resolution,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

        let mut updated = record.clone();
        updated["status"] = json!("resolved");
        updated["resolution"] = json!(input.resolution);
        updated["resolvedBy"] = json!(input.resolved_by);
        updated["history"] = json!(serde_json::to_string(&history)?);
        updated["resolvedAt"] = json!(chrono::Utc::now().to_rfc3339());
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("escalation", &input.escalation_id, updated).await?;

        Ok(EscalationResolveOutput::Ok {
            escalation_id: input.escalation_id,
            status: "resolved".to_string(),
        })
    }

    async fn re_escalate(
        &self,
        input: EscalationReEscalateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<EscalationReEscalateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("escalation", &input.escalation_id).await?;
        let record = match existing {
            Some(r) => r,
            None => return Ok(EscalationReEscalateOutput::NotFound {
                escalation_id: input.escalation_id,
            }),
        };

        let status = record["status"].as_str().unwrap_or("");
        if status != "accepted" && status != "escalated" {
            return Ok(EscalationReEscalateOutput::InvalidState {
                escalation_id: input.escalation_id,
                current_status: status.to_string(),
            });
        }

        let current_level = record["level"].as_i64().unwrap_or(1);
        let new_level = current_level + 1;

        let mut history: Vec<serde_json::Value> = serde_json::from_str(
            record["history"].as_str().unwrap_or("[]")
        )?;
        history.push(json!({
            "action": "re_escalated",
            "to": input.escalate_to,
            "reason": input.reason,
            "level": new_level,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

        let mut updated = record.clone();
        updated["status"] = json!("escalated");
        updated["assignedTo"] = json!(input.escalate_to);
        updated["level"] = json!(new_level);
        updated["history"] = json!(serde_json::to_string(&history)?);
        updated["updatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        storage.put("escalation", &input.escalation_id, updated).await?;

        Ok(EscalationReEscalateOutput::Ok {
            escalation_id: input.escalation_id,
            status: "escalated".to_string(),
            level: new_level,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_escalate() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;
        let result = handler.escalate(
            EscalationEscalateInput {
                subject: "Server outage".into(),
                reason: "P1 incident unresolved".into(),
                escalated_by: "alice".into(),
                escalate_to: "ops-lead".into(),
                severity: "critical".into(),
                context: Some("Ticket #1234".into()),
            },
            &storage,
        ).await.unwrap();
        match result {
            EscalationEscalateOutput::Ok { escalation_id, status, level } => {
                assert!(!escalation_id.is_empty());
                assert_eq!(status, "escalated");
                assert_eq!(level, 1);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_accept_escalation() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Issue".into(),
                reason: "Needs attention".into(),
                escalated_by: "alice".into(),
                escalate_to: "bob".into(),
                severity: "high".into(),
                context: None,
            },
            &storage,
        ).await.unwrap();
        let id = match esc { EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id, _ => panic!("Expected Ok") };

        let result = handler.accept(
            EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "bob".into() },
            &storage,
        ).await.unwrap();
        match result {
            EscalationAcceptOutput::Ok { status, .. } => assert_eq!(status, "accepted"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_escalation() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Bug".into(), reason: "Critical".into(),
                escalated_by: "alice".into(), escalate_to: "bob".into(),
                severity: "high".into(), context: None,
            },
            &storage,
        ).await.unwrap();
        let id = match esc { EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id, _ => panic!("Expected Ok") };

        handler.accept(EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "bob".into() }, &storage).await.unwrap();

        let result = handler.resolve(
            EscalationResolveInput { escalation_id: id.clone(), resolved_by: "bob".into(), resolution: "Fixed root cause".into() },
            &storage,
        ).await.unwrap();
        match result {
            EscalationResolveOutput::Ok { status, .. } => assert_eq!(status, "resolved"),
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_re_escalate() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Incident".into(), reason: "Unresolved".into(),
                escalated_by: "alice".into(), escalate_to: "bob".into(),
                severity: "high".into(), context: None,
            },
            &storage,
        ).await.unwrap();
        let id = match esc { EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id, _ => panic!("Expected Ok") };

        handler.accept(EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "bob".into() }, &storage).await.unwrap();

        let result = handler.re_escalate(
            EscalationReEscalateInput {
                escalation_id: id.clone(),
                reason: "Still unresolved after 2 hours".into(),
                escalate_to: "vp-eng".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            EscalationReEscalateOutput::Ok { status, level, .. } => {
                assert_eq!(status, "escalated");
                assert_eq!(level, 2);
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_accept_wrong_person() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Issue".into(), reason: "Help".into(),
                escalated_by: "alice".into(), escalate_to: "bob".into(),
                severity: "medium".into(), context: None,
            },
            &storage,
        ).await.unwrap();
        let id = match esc { EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id, _ => panic!("Expected Ok") };

        let result = handler.accept(
            EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "eve".into() },
            &storage,
        ).await.unwrap();
        match result {
            EscalationAcceptOutput::NotAssigned { .. } => {}
            _ => panic!("Expected NotAssigned variant"),
        }
    }

    #[tokio::test]
    async fn test_resolve_requires_accepted() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Issue".into(), reason: "Urgent".into(),
                escalated_by: "alice".into(), escalate_to: "bob".into(),
                severity: "high".into(), context: None,
            },
            &storage,
        ).await.unwrap();
        let id = match esc { EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id, _ => panic!("Expected Ok") };

        let result = handler.resolve(
            EscalationResolveInput { escalation_id: id.clone(), resolved_by: "bob".into(), resolution: "Fixed".into() },
            &storage,
        ).await.unwrap();
        match result {
            EscalationResolveOutput::InvalidState { current_status, .. } => {
                assert_eq!(current_status, "escalated");
            }
            _ => panic!("Expected InvalidState variant"),
        }
    }
}
