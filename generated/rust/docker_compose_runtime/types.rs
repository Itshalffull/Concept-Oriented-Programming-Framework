// generated: docker_compose_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeRuntimeProvisionInput {
    pub concept: String,
    pub compose_path: String,
    pub ports: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeRuntimeProvisionOutput {
    Ok {
        service: String,
        service_name: String,
        endpoint: String,
    },
    PortConflict {
        port: i64,
        existing_service: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeRuntimeDeployInput {
    pub service: String,
    pub image_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeRuntimeDeployOutput {
    Ok {
        service: String,
        container_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeRuntimeSetTrafficWeightInput {
    pub service: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeRuntimeSetTrafficWeightOutput {
    Ok {
        service: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeRuntimeRollbackInput {
    pub service: String,
    pub target_image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeRuntimeRollbackOutput {
    Ok {
        service: String,
        restored_image: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeRuntimeDestroyInput {
    pub service: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeRuntimeDestroyOutput {
    Ok {
        service: String,
    },
}

