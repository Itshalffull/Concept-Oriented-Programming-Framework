// Business logic tests for Escalation concept.
// Validates escalation level progression, assignment enforcement,
// state machine constraints, and multi-level re-escalation chains.

#[cfg(test)]
mod tests {
    use super::super::handler::EscalationHandler;
    use super::super::r#impl::EscalationHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_multi_level_re_escalation_chain() {
        // Escalate L1 -> accept -> re-escalate to L2 -> accept -> re-escalate to L3
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(EscalationEscalateInput {
            subject: "Production outage".into(),
            reason: "Service down for 30 min".into(),
            escalated_by: "on-call".into(),
            escalate_to: "team-lead".into(),
            severity: "critical".into(),
            context: Some("Incident #555".into()),
        }, &storage).await.unwrap();
        let id = match esc {
            EscalationEscalateOutput::Ok { escalation_id, level, .. } => {
                assert_eq!(level, 1);
                escalation_id
            }
            _ => panic!("Expected Ok"),
        };

        // L1 accepts
        handler.accept(EscalationAcceptInput {
            escalation_id: id.clone(),
            accepted_by: "team-lead".into(),
        }, &storage).await.unwrap();

        // Re-escalate to L2
        let re1 = handler.re_escalate(EscalationReEscalateInput {
            escalation_id: id.clone(),
            reason: "Unable to resolve".into(),
            escalate_to: "director".into(),
        }, &storage).await.unwrap();
        match re1 {
            EscalationReEscalateOutput::Ok { level, .. } => assert_eq!(level, 2),
            _ => panic!("Expected Ok"),
        }

        // L2 accepts
        handler.accept(EscalationAcceptInput {
            escalation_id: id.clone(),
            accepted_by: "director".into(),
        }, &storage).await.unwrap();

        // Re-escalate to L3
        let re2 = handler.re_escalate(EscalationReEscalateInput {
            escalation_id: id.clone(),
            reason: "Requires VP approval".into(),
            escalate_to: "vp-eng".into(),
        }, &storage).await.unwrap();
        match re2 {
            EscalationReEscalateOutput::Ok { level, .. } => assert_eq!(level, 3),
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_cannot_resolve_without_accepting_first() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(EscalationEscalateInput {
            subject: "Issue".into(),
            reason: "Needs fix".into(),
            escalated_by: "alice".into(),
            escalate_to: "bob".into(),
            severity: "high".into(),
            context: None,
        }, &storage).await.unwrap();
        let id = match esc {
            EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id,
            _ => panic!("Expected Ok"),
        };

        let result = handler.resolve(EscalationResolveInput {
            escalation_id: id.clone(),
            resolved_by: "bob".into(),
            resolution: "Fixed".into(),
        }, &storage).await.unwrap();
        match result {
            EscalationResolveOutput::InvalidState { current_status, .. } => {
                assert_eq!(current_status, "escalated");
            }
            _ => panic!("Expected InvalidState"),
        }
    }

    #[tokio::test]
    async fn test_resolved_cannot_be_re_escalated() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(EscalationEscalateInput {
            subject: "Bug".into(),
            reason: "Critical bug".into(),
            escalated_by: "alice".into(),
            escalate_to: "bob".into(),
            severity: "high".into(),
            context: None,
        }, &storage).await.unwrap();
        let id = match esc {
            EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id,
            _ => panic!("Expected Ok"),
        };

        handler.accept(EscalationAcceptInput {
            escalation_id: id.clone(),
            accepted_by: "bob".into(),
        }, &storage).await.unwrap();

        handler.resolve(EscalationResolveInput {
            escalation_id: id.clone(),
            resolved_by: "bob".into(),
            resolution: "Patched".into(),
        }, &storage).await.unwrap();

        let result = handler.re_escalate(EscalationReEscalateInput {
            escalation_id: id.clone(),
            reason: "Patch failed".into(),
            escalate_to: "vp".into(),
        }, &storage).await.unwrap();
        match result {
            EscalationReEscalateOutput::InvalidState { current_status, .. } => {
                assert_eq!(current_status, "resolved");
            }
            _ => panic!("Expected InvalidState"),
        }
    }

    #[tokio::test]
    async fn test_empty_subject_validation_error() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let result = handler.escalate(EscalationEscalateInput {
            subject: "".into(),
            reason: "some reason".into(),
            escalated_by: "alice".into(),
            escalate_to: "bob".into(),
            severity: "low".into(),
            context: None,
        }, &storage).await.unwrap();
        match result {
            EscalationEscalateOutput::ValidationError { message } => {
                assert!(message.contains("empty"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[tokio::test]
    async fn test_empty_reason_validation_error() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let result = handler.escalate(EscalationEscalateInput {
            subject: "Valid subject".into(),
            reason: "".into(),
            escalated_by: "alice".into(),
            escalate_to: "bob".into(),
            severity: "low".into(),
            context: None,
        }, &storage).await.unwrap();
        match result {
            EscalationEscalateOutput::ValidationError { .. } => {}
            _ => panic!("Expected ValidationError"),
        }
    }

    #[tokio::test]
    async fn test_re_escalate_from_escalated_without_accepting() {
        // Re-escalation should be allowed from escalated status too
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(EscalationEscalateInput {
            subject: "Urgent".into(),
            reason: "SLA breach".into(),
            escalated_by: "system".into(),
            escalate_to: "l1-support".into(),
            severity: "critical".into(),
            context: None,
        }, &storage).await.unwrap();
        let id = match esc {
            EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id,
            _ => panic!("Expected Ok"),
        };

        // Re-escalate directly without accepting
        let result = handler.re_escalate(EscalationReEscalateInput {
            escalation_id: id.clone(),
            reason: "L1 did not respond in time".into(),
            escalate_to: "l2-support".into(),
        }, &storage).await.unwrap();
        match result {
            EscalationReEscalateOutput::Ok { level, status, .. } => {
                assert_eq!(level, 2);
                assert_eq!(status, "escalated");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_accept_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let result = handler.accept(EscalationAcceptInput {
            escalation_id: "esc-missing".into(),
            accepted_by: "bob".into(),
        }, &storage).await.unwrap();
        match result {
            EscalationAcceptOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_resolve_not_found() {
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let result = handler.resolve(EscalationResolveInput {
            escalation_id: "esc-missing".into(),
            resolved_by: "bob".into(),
            resolution: "n/a".into(),
        }, &storage).await.unwrap();
        match result {
            EscalationResolveOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }
}
