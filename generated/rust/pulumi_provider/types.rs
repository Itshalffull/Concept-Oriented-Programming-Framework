// generated: pulumi_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PulumiProviderGenerateInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PulumiProviderGenerateOutput {
    Ok {
        stack: String,
        files: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PulumiProviderPreviewInput {
    pub stack: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PulumiProviderPreviewOutput {
    Ok {
        stack: String,
        to_create: i64,
        to_update: i64,
        to_delete: i64,
        estimated_cost: f64,
    },
    BackendUnreachable {
        backend: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PulumiProviderApplyInput {
    pub stack: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PulumiProviderApplyOutput {
    Ok {
        stack: String,
        created: Vec<String>,
        updated: Vec<String>,
    },
    PluginMissing {
        plugin: String,
        version: String,
    },
    ConflictingUpdate {
        stack: String,
        pending_ops: Vec<String>,
    },
    Partial {
        stack: String,
        created: Vec<String>,
        failed: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PulumiProviderTeardownInput {
    pub stack: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum PulumiProviderTeardownOutput {
    Ok {
        stack: String,
        destroyed: Vec<String>,
    },
    ProtectedResource {
        stack: String,
        resource: String,
    },
}

