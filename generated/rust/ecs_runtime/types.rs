// generated: ecs_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EcsRuntimeProvisionInput {
    pub concept: String,
    pub cpu: i64,
    pub memory: i64,
    pub cluster: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EcsRuntimeProvisionOutput {
    Ok {
        service: String,
        service_arn: String,
        endpoint: String,
    },
    CapacityUnavailable {
        cluster: String,
        requested: String,
    },
    ClusterNotFound {
        cluster: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EcsRuntimeDeployInput {
    pub service: String,
    pub image_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EcsRuntimeDeployOutput {
    Ok {
        service: String,
        task_definition: String,
    },
    ImageNotFound {
        image_uri: String,
    },
    HealthCheckFailed {
        service: String,
        failed_tasks: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EcsRuntimeSetTrafficWeightInput {
    pub service: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EcsRuntimeSetTrafficWeightOutput {
    Ok {
        service: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EcsRuntimeRollbackInput {
    pub service: String,
    pub target_task_definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EcsRuntimeRollbackOutput {
    Ok {
        service: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EcsRuntimeDestroyInput {
    pub service: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EcsRuntimeDestroyOutput {
    Ok {
        service: String,
    },
    DrainTimeout {
        service: String,
        active_connections: i64,
    },
}

