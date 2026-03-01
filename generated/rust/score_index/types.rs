// generated: score_index/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreIndexUpsertConceptInput {
    pub name: String,
    pub purpose: String,
    pub actions: Vec<String>,
    pub state_fields: Vec<String>,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreIndexUpsertConceptOutput {
    Ok {
        index: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreIndexUpsertSyncInput {
    pub name: String,
    pub annotation: String,
    pub triggers: Vec<String>,
    pub effects: Vec<String>,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreIndexUpsertSyncOutput {
    Ok {
        index: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreIndexUpsertSymbolInput {
    pub name: String,
    pub kind: String,
    pub file: String,
    pub line: i64,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreIndexUpsertSymbolOutput {
    Ok {
        index: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreIndexUpsertFileInput {
    pub path: String,
    pub language: String,
    pub role: String,
    pub definitions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreIndexUpsertFileOutput {
    Ok {
        index: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreIndexRemoveByFileInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreIndexRemoveByFileOutput {
    Ok {
        removed: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreIndexClearInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreIndexClearOutput {
    Ok {
        cleared: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreIndexStatsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScoreIndexStatsOutput {
    Ok {
        concept_count: i64,
        sync_count: i64,
        symbol_count: i64,
        file_count: i64,
        last_updated: DateTime<Utc>,
    },
}

