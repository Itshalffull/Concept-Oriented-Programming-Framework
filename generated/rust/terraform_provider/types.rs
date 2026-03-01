// generated: terraform_provider/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TerraformProviderGenerateInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TerraformProviderGenerateOutput {
    Ok {
        workspace: String,
        files: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TerraformProviderPreviewInput {
    pub workspace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TerraformProviderPreviewOutput {
    Ok {
        workspace: String,
        to_create: i64,
        to_update: i64,
        to_delete: i64,
    },
    StateLocked {
        workspace: String,
        lock_id: String,
        locked_by: String,
    },
    BackendInitRequired {
        workspace: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TerraformProviderApplyInput {
    pub workspace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TerraformProviderApplyOutput {
    Ok {
        workspace: String,
        created: Vec<String>,
        updated: Vec<String>,
    },
    StateLocked {
        workspace: String,
        lock_id: String,
    },
    Partial {
        workspace: String,
        created: Vec<String>,
        failed: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TerraformProviderTeardownInput {
    pub workspace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TerraformProviderTeardownOutput {
    Ok {
        workspace: String,
        destroyed: Vec<String>,
    },
}

