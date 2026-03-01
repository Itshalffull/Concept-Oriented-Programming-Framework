// generated: k8s_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct K8sRuntimeProvisionInput {
    pub concept: String,
    pub namespace: String,
    pub cluster: String,
    pub replicas: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum K8sRuntimeProvisionOutput {
    Ok {
        deployment: String,
        service_name: String,
        endpoint: String,
    },
    ResourceQuotaExceeded {
        namespace: String,
        resource: String,
        requested: String,
        limit: String,
    },
    NamespaceNotFound {
        namespace: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct K8sRuntimeDeployInput {
    pub deployment: String,
    pub image_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum K8sRuntimeDeployOutput {
    Ok {
        deployment: String,
        revision: String,
    },
    PodCrashLoop {
        deployment: String,
        pod_name: String,
        restart_count: i64,
    },
    ImageNotFound {
        image_uri: String,
    },
    ImagePullBackOff {
        deployment: String,
        image_uri: String,
        reason: String,
    },
    OomKilled {
        deployment: String,
        pod_name: String,
        memory_limit: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct K8sRuntimeSetTrafficWeightInput {
    pub deployment: String,
    pub weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum K8sRuntimeSetTrafficWeightOutput {
    Ok {
        deployment: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct K8sRuntimeRollbackInput {
    pub deployment: String,
    pub target_revision: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum K8sRuntimeRollbackOutput {
    Ok {
        deployment: String,
        restored_revision: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct K8sRuntimeDestroyInput {
    pub deployment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum K8sRuntimeDestroyOutput {
    Ok {
        deployment: String,
    },
}

