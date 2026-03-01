// Escalation concept types
// Models escalation workflows: escalate, accept, resolve, re_escalate.

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EscalationEscalateInput {
    pub subject: String,
    pub reason: String,
    pub escalated_by: String,
    pub escalate_to: String,
    pub severity: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EscalationEscalateOutput {
    Ok {
        escalation_id: String,
        status: String,
        level: i64,
    },
    ValidationError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EscalationAcceptInput {
    pub escalation_id: String,
    pub accepted_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EscalationAcceptOutput {
    Ok {
        escalation_id: String,
        status: String,
    },
    NotAssigned {
        escalation_id: String,
        message: String,
    },
    InvalidState {
        escalation_id: String,
        current_status: String,
    },
    NotFound {
        escalation_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EscalationResolveInput {
    pub escalation_id: String,
    pub resolved_by: String,
    pub resolution: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EscalationResolveOutput {
    Ok {
        escalation_id: String,
        status: String,
    },
    InvalidState {
        escalation_id: String,
        current_status: String,
    },
    NotFound {
        escalation_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EscalationReEscalateInput {
    pub escalation_id: String,
    pub reason: String,
    pub escalate_to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EscalationReEscalateOutput {
    Ok {
        escalation_id: String,
        status: String,
        level: i64,
    },
    InvalidState {
        escalation_id: String,
        current_status: String,
    },
    NotFound {
        escalation_id: String,
    },
}
