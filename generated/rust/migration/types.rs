// generated: migration/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MigrationCheckInput {
    pub concept: String,
    pub spec_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MigrationCheckOutput {
    Ok,
    NeedsMigration {
        from: i64,
        to: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MigrationCompleteInput {
    pub concept: String,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MigrationCompleteOutput {
    Ok,
}

