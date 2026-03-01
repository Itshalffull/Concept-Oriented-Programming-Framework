// generated: sync_entity/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEntityRegisterInput {
    pub name: String,
    pub source: String,
    pub compiled: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEntityRegisterOutput {
    Ok {
        sync: String,
    },
    AlreadyRegistered {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEntityFindByConceptInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEntityFindByConceptOutput {
    Ok {
        syncs: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEntityFindTriggerableByInput {
    pub action: String,
    pub variant: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEntityFindTriggerableByOutput {
    Ok {
        syncs: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEntityChainFromInput {
    pub action: String,
    pub variant: String,
    pub depth: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEntityChainFromOutput {
    Ok {
        chain: String,
    },
    NoChain,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEntityFindDeadEndsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEntityFindDeadEndsOutput {
    Ok {
        dead_ends: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEntityFindOrphanVariantsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEntityFindOrphanVariantsOutput {
    Ok {
        orphans: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncEntityGetInput {
    pub sync: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyncEntityGetOutput {
    Ok {
        sync: String,
        name: String,
        annotations: String,
        tier: String,
        when_pattern_count: i64,
        then_action_count: i64,
    },
    Notfound,
}

