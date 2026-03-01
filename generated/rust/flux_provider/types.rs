// generated: flux_provider/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FluxProviderEmitInput {
    pub plan: String,
    pub repo: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FluxProviderEmitOutput {
    Ok {
        kustomization: String,
        files: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FluxProviderReconciliationStatusInput {
    pub kustomization: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FluxProviderReconciliationStatusOutput {
    Ok {
        kustomization: String,
        ready_status: String,
        applied_revision: String,
        reconciled_at: DateTime<Utc>,
    },
    Pending {
        kustomization: String,
        waiting_on: Vec<String>,
    },
    Failed {
        kustomization: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FluxProviderHelmReleaseInput {
    pub kustomization: String,
    pub chart: String,
    pub values: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FluxProviderHelmReleaseOutput {
    Ok {
        kustomization: String,
        release_name: String,
    },
    ChartNotFound {
        chart: String,
        source_ref: String,
    },
}

