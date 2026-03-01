// generated: vercel_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VercelRuntimeProvisionInput {
    pub concept: String,
    pub team_id: String,
    pub framework: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VercelRuntimeProvisionOutput {
    Ok {
        project: String,
        project_id: String,
        endpoint: String,
    },
    DomainConflict {
        domain: String,
        existing_project: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VercelRuntimeDeployInput {
    pub project: String,
    pub source_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VercelRuntimeDeployOutput {
    Ok {
        project: String,
        deployment_id: String,
        deployment_url: String,
    },
    BuildFailed {
        project: String,
        errors: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VercelRuntimeSetTrafficWeightInput {
    pub project: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VercelRuntimeSetTrafficWeightOutput {
    Ok {
        project: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VercelRuntimeRollbackInput {
    pub project: String,
    pub target_deployment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VercelRuntimeRollbackOutput {
    Ok {
        project: String,
        restored_deployment_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VercelRuntimeDestroyInput {
    pub project: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VercelRuntimeDestroyOutput {
    Ok {
        project: String,
    },
}

