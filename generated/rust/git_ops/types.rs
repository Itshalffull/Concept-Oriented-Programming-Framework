// generated: git_ops/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GitOpsEmitInput {
    pub plan: String,
    pub controller: String,
    pub repo: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GitOpsEmitOutput {
    Ok {
        manifest: String,
        files: Vec<String>,
    },
    ControllerUnsupported {
        controller: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GitOpsReconciliationStatusInput {
    pub manifest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GitOpsReconciliationStatusOutput {
    Ok {
        manifest: String,
        status: String,
        reconciled_at: DateTime<Utc>,
    },
    Pending {
        manifest: String,
        waiting_on: Vec<String>,
    },
    Failed {
        manifest: String,
        reason: String,
    },
}

