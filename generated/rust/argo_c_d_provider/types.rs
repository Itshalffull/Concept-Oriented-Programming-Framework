// generated: argo_c_d_provider/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArgoCDProviderEmitInput {
    pub plan: String,
    pub repo: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArgoCDProviderEmitOutput {
    Ok {
        application: String,
        files: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArgoCDProviderReconciliationStatusInput {
    pub application: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArgoCDProviderReconciliationStatusOutput {
    Ok {
        application: String,
        sync_status: String,
        health_status: String,
        reconciled_at: DateTime<Utc>,
    },
    Pending {
        application: String,
        waiting_on: Vec<String>,
    },
    Degraded {
        application: String,
        unhealthy_resources: Vec<String>,
    },
    Failed {
        application: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArgoCDProviderSyncWaveInput {
    pub application: String,
    pub wave: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArgoCDProviderSyncWaveOutput {
    Ok {
        application: String,
    },
}

