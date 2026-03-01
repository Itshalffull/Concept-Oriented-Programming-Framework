// generated: docker_compose_iac_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeIacProviderGenerateInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeIacProviderGenerateOutput {
    Ok {
        compose_file: String,
        files: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeIacProviderPreviewInput {
    pub compose_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeIacProviderPreviewOutput {
    Ok {
        compose_file: String,
        to_create: i64,
        to_update: i64,
        to_delete: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeIacProviderApplyInput {
    pub compose_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeIacProviderApplyOutput {
    Ok {
        compose_file: String,
        created: Vec<String>,
        updated: Vec<String>,
    },
    PortConflict {
        port: i64,
        existing_service: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DockerComposeIacProviderTeardownInput {
    pub compose_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DockerComposeIacProviderTeardownOutput {
    Ok {
        compose_file: String,
        destroyed: Vec<String>,
    },
}

