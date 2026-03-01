// generated: cloudflare_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudflareRuntimeProvisionInput {
    pub concept: String,
    pub account_id: String,
    pub routes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudflareRuntimeProvisionOutput {
    Ok {
        worker: String,
        script_name: String,
        endpoint: String,
    },
    RouteConflict {
        route: String,
        existing_worker: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudflareRuntimeDeployInput {
    pub worker: String,
    pub script_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudflareRuntimeDeployOutput {
    Ok {
        worker: String,
        version: String,
    },
    ScriptTooLarge {
        worker: String,
        size_bytes: i64,
        limit_bytes: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudflareRuntimeSetTrafficWeightInput {
    pub worker: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudflareRuntimeSetTrafficWeightOutput {
    Ok {
        worker: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudflareRuntimeRollbackInput {
    pub worker: String,
    pub target_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudflareRuntimeRollbackOutput {
    Ok {
        worker: String,
        restored_version: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CloudflareRuntimeDestroyInput {
    pub worker: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum CloudflareRuntimeDestroyOutput {
    Ok {
        worker: String,
    },
}

