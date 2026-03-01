// generated: retention_policy/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetentionPolicySetRetentionInput {
    pub record_type: String,
    pub period: i64,
    pub unit: String,
    pub disposition_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetentionPolicySetRetentionOutput {
    Ok {
        policy_id: String,
    },
    AlreadyExists {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetentionPolicyApplyHoldInput {
    pub name: String,
    pub scope: String,
    pub reason: String,
    pub issuer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetentionPolicyApplyHoldOutput {
    Ok {
        hold_id: serde_json::Value,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetentionPolicyReleaseHoldInput {
    pub hold_id: serde_json::Value,
    pub released_by: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetentionPolicyReleaseHoldOutput {
    Ok,
    NotFound {
        message: String,
    },
    AlreadyReleased {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetentionPolicyCheckDispositionInput {
    pub record: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetentionPolicyCheckDispositionOutput {
    Disposable {
        policy_id: String,
    },
    Retained {
        reason: String,
        until: String,
    },
    Held {
        hold_names: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetentionPolicyDisposeInput {
    pub record: String,
    pub disposed_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetentionPolicyDisposeOutput {
    Ok,
    Retained {
        reason: String,
    },
    Held {
        hold_names: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RetentionPolicyAuditLogInput {
    pub record: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RetentionPolicyAuditLogOutput {
    Ok {
        entries: Vec<{ record: String, policy: String, disposed_at: String, disposed_by: String }>,
    },
}

