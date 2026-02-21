// generated: config_sync/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfigSyncExportInput {
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConfigSyncExportOutput {
    Ok {
        data: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfigSyncImportInput {
    pub config: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConfigSyncImportOutput {
    Ok,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfigSyncOverrideInput {
    pub config: String,
    pub layer: String,
    pub values: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConfigSyncOverrideOutput {
    Ok,
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ConfigSyncDiffInput {
    pub config_a: String,
    pub config_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ConfigSyncDiffOutput {
    Ok {
        changes: String,
    },
    Notfound,
}

