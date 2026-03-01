// generated: snapshot/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotCompareInput {
    pub output_path: String,
    pub current_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SnapshotCompareOutput {
    Unchanged {
        snapshot: String,
    },
    Changed {
        snapshot: String,
        diff: String,
        lines_added: i64,
        lines_removed: i64,
    },
    New {
        path: String,
        content_hash: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotApproveInput {
    pub path: String,
    pub approver: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SnapshotApproveOutput {
    Ok {
        snapshot: String,
    },
    NoChange {
        snapshot: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotApproveAllInput {
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SnapshotApproveAllOutput {
    Ok {
        approved: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotRejectInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SnapshotRejectOutput {
    Ok {
        snapshot: String,
    },
    NoChange {
        snapshot: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotStatusInput {
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SnapshotStatusOutput {
    Ok {
        results: Vec<{ path: String, status: String, lines_changed: Option<i64>, approved_at: Option<DateTime<Utc>> }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotDiffInput {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SnapshotDiffOutput {
    Ok {
        diff: String,
        lines_added: i64,
        lines_removed: i64,
    },
    NoBaseline {
        path: String,
    },
    Unchanged {
        path: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotCleanInput {
    pub output_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SnapshotCleanOutput {
    Ok {
        removed: Vec<String>,
    },
}

