// generated: variant_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VariantEntityRegisterInput {
    pub action: String,
    pub tag: String,
    pub fields: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VariantEntityRegisterOutput {
    Ok {
        variant: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VariantEntityMatchingSyncsInput {
    pub variant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VariantEntityMatchingSyncsOutput {
    Ok {
        syncs: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VariantEntityIsDeadInput {
    pub variant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VariantEntityIsDeadOutput {
    Dead {
        no_matching_syncs: String,
        no_runtime_occurrences: String,
    },
    Alive {
        sync_count: i64,
        runtime_count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VariantEntityGetInput {
    pub variant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum VariantEntityGetOutput {
    Ok {
        variant: String,
        action: String,
        tag: String,
        fields: String,
    },
    Notfound,
}

