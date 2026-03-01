// generated: migration/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MigrationPlanInput {
    pub concept: String,
    pub from_version: i64,
    pub to_version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MigrationPlanOutput {
    Ok {
        migration: String,
        steps: Vec<String>,
        estimated_records: i64,
    },
    NoMigrationNeeded {
        concept: String,
    },
    Incompatible {
        concept: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MigrationExpandInput {
    pub migration: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MigrationExpandOutput {
    Ok {
        migration: String,
    },
    Failed {
        migration: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MigrationMigrateInput {
    pub migration: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MigrationMigrateOutput {
    Ok {
        migration: String,
        records_migrated: i64,
    },
    Partial {
        migration: String,
        migrated: i64,
        failed: i64,
        errors: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MigrationContractInput {
    pub migration: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MigrationContractOutput {
    Ok {
        migration: String,
    },
    Rollback {
        migration: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MigrationStatusInput {
    pub migration: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MigrationStatusOutput {
    Ok {
        migration: String,
        phase: String,
        progress: f64,
    },
}

