// generated: cloud_run_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudRunRuntimeProvisionInput {
    pub concept: String,
    pub project_id: String,
    pub region: String,
    pub cpu: i64,
    pub memory: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudRunRuntimeProvisionOutput {
    Ok {
        service: String,
        service_url: String,
        endpoint: String,
    },
    BillingDisabled {
        project_id: String,
    },
    RegionUnavailable {
        region: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudRunRuntimeDeployInput {
    pub service: String,
    pub image_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudRunRuntimeDeployOutput {
    Ok {
        service: String,
        revision: String,
    },
    ImageNotFound {
        image_uri: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudRunRuntimeSetTrafficWeightInput {
    pub service: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudRunRuntimeSetTrafficWeightOutput {
    Ok {
        service: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudRunRuntimeRollbackInput {
    pub service: String,
    pub target_revision: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudRunRuntimeRollbackOutput {
    Ok {
        service: String,
        restored_revision: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudRunRuntimeDestroyInput {
    pub service: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudRunRuntimeDestroyOutput {
    Ok {
        service: String,
    },
}

