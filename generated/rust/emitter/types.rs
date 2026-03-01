// generated: emitter/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterWriteInput {
    pub path: String,
    pub content: String,
    pub format_hint: Option<String>,
    pub sources: Option<Vec<{ source_path: String, source_range: Option<String>, concept_name: Option<String>, action_name: Option<String> }>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterWriteOutput {
    Ok {
        written: bool,
        path: String,
        content_hash: String,
    },
    Error {
        message: String,
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterWriteBatchInput {
    pub files: Vec<{ path: String, content: String, format_hint: Option<String>, sources: Option<Vec<{ source_path: String, source_range: Option<String>, concept_name: Option<String>, action_name: Option<String> }>> }>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterWriteBatchOutput {
    Ok {
        results: Vec<{ path: String, written: bool, content_hash: String }>,
    },
    Error {
        message: String,
        failed_path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterFormatInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterFormatOutput {
    Ok {
        changed: bool,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterCleanInput {
    pub output_dir: String,
    pub current_manifest: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterCleanOutput {
    Ok {
        removed: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterManifestInput {
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterManifestOutput {
    Ok {
        files: Vec<{ path: String, hash: String, last_written: DateTime<Utc> }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterTraceInput {
    pub output_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterTraceOutput {
    Ok {
        sources: Vec<{ source_path: String, source_range: Option<String>, concept_name: Option<String>, action_name: Option<String> }>,
    },
    NotFound {
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterAffectedInput {
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterAffectedOutput {
    Ok {
        outputs: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmitterAuditInput {
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EmitterAuditOutput {
    Ok {
        status: Vec<{ path: String, state: String, expected_hash: Option<String>, actual_hash: Option<String> }>,
    },
}

