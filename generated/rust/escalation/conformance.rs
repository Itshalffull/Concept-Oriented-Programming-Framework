// Escalation concept conformance tests
// Validates escalation lifecycle invariants: escalated -> accepted -> resolved,
// re-escalation level increments, and state transition guards.

#[cfg(test)]
mod tests {
    use super::super::handler::EscalationHandler;
    use super::super::r#impl::EscalationHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn escalation_full_lifecycle_invariant() {
        // Invariant: escalated -> accepted -> resolved is a valid path
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Incident #100".into(),
                reason: "SLA breach imminent".into(),
                escalated_by: "support-agent".into(),
                escalate_to: "team-lead".into(),
                severity: "critical".into(),
                context: Some("Customer X impacted".into()),
            },
            &storage,
        ).await.unwrap();
        let id = match esc {
            EscalationEscalateOutput::Ok { escalation_id, status, level } => {
                assert_eq!(status, "escalated");
                assert_eq!(level, 1);
                escalation_id
            }
            other => panic!("Expected Ok, got {:?}", other),
        };

        let accept = handler.accept(
            EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "team-lead".into() },
            &storage,
        ).await.unwrap();
        match accept {
            EscalationAcceptOutput::Ok { status, .. } => assert_eq!(status, "accepted"),
            other => panic!("Expected Ok, got {:?}", other),
        }

        let resolve = handler.resolve(
            EscalationResolveInput {
                escalation_id: id.clone(),
                resolved_by: "team-lead".into(),
                resolution: "Root cause identified and fixed".into(),
            },
            &storage,
        ).await.unwrap();
        match resolve {
            EscalationResolveOutput::Ok { status, .. } => assert_eq!(status, "resolved"),
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn escalation_re_escalate_increments_level_invariant() {
        // Invariant: re-escalation always increments the level
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Ongoing incident".into(),
                reason: "Needs more authority".into(),
                escalated_by: "agent".into(),
                escalate_to: "manager".into(),
                severity: "high".into(),
                context: None,
            },
            &storage,
        ).await.unwrap();
        let id = match esc {
            EscalationEscalateOutput::Ok { escalation_id, level, .. } => {
                assert_eq!(level, 1);
                escalation_id
            }
            other => panic!("Expected Ok, got {:?}", other),
        };

        handler.accept(
            EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "manager".into() },
            &storage,
        ).await.unwrap();

        let re_esc = handler.re_escalate(
            EscalationReEscalateInput {
                escalation_id: id.clone(),
                reason: "Manager cannot resolve alone".into(),
                escalate_to: "director".into(),
            },
            &storage,
        ).await.unwrap();
        match re_esc {
            EscalationReEscalateOutput::Ok { level, .. } => assert_eq!(level, 2),
            other => panic!("Expected Ok, got {:?}", other),
        }

        handler.accept(
            EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "director".into() },
            &storage,
        ).await.unwrap();

        let re_esc2 = handler.re_escalate(
            EscalationReEscalateInput {
                escalation_id: id.clone(),
                reason: "Executive decision required".into(),
                escalate_to: "vp".into(),
            },
            &storage,
        ).await.unwrap();
        match re_esc2 {
            EscalationReEscalateOutput::Ok { level, .. } => assert_eq!(level, 3),
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn escalation_resolved_is_terminal_invariant() {
        // Invariant: once resolved, re-escalation is rejected
        let storage = InMemoryStorage::new();
        let handler = EscalationHandlerImpl;

        let esc = handler.escalate(
            EscalationEscalateInput {
                subject: "Issue".into(), reason: "Help".into(),
                escalated_by: "a".into(), escalate_to: "b".into(),
                severity: "low".into(), context: None,
            },
            &storage,
        ).await.unwrap();
        let id = match esc { EscalationEscalateOutput::Ok { escalation_id, .. } => escalation_id, other => panic!("Expected Ok, got {:?}", other) };

        handler.accept(EscalationAcceptInput { escalation_id: id.clone(), accepted_by: "b".into() }, &storage).await.unwrap();
        handler.resolve(EscalationResolveInput { escalation_id: id.clone(), resolved_by: "b".into(), resolution: "Done".into() }, &storage).await.unwrap();

        let result = handler.re_escalate(
            EscalationReEscalateInput { escalation_id: id.clone(), reason: "Reopen".into(), escalate_to: "c".into() },
            &storage,
        ).await.unwrap();
        match result {
            EscalationReEscalateOutput::InvalidState { current_status, .. } => {
                assert_eq!(current_status, "resolved");
            }
            other => panic!("Expected InvalidState, got {:?}", other),
        }
    }
}
