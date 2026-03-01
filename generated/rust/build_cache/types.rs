// generated: build_cache/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheCheckInput {
    pub step_key: String,
    pub input_hash: String,
    pub deterministic: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheCheckOutput {
    Unchanged {
        last_run: DateTime<Utc>,
        output_ref: Option<String>,
    },
    Changed {
        previous_hash: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheRecordInput {
    pub step_key: String,
    pub input_hash: String,
    pub output_hash: String,
    pub output_ref: Option<String>,
    pub source_locator: Option<String>,
    pub deterministic: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheRecordOutput {
    Ok {
        entry: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheInvalidateInput {
    pub step_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheInvalidateOutput {
    Ok,
    NotFound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheInvalidateBySourceInput {
    pub source_locator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheInvalidateBySourceOutput {
    Ok {
        invalidated: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheInvalidateByKindInput {
    pub kind_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheInvalidateByKindOutput {
    Ok {
        invalidated: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheInvalidateAllInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheInvalidateAllOutput {
    Ok {
        cleared: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheStatusInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheStatusOutput {
    Ok {
        entries: Vec<{ step_key: String, input_hash: String, last_run: DateTime<Utc>, stale: bool }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuildCacheStaleStepsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuildCacheStaleStepsOutput {
    Ok {
        steps: Vec<String>,
    },
}

