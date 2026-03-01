// generated: resource/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourceUpsertInput {
    pub locator: String,
    pub kind: String,
    pub digest: String,
    pub last_modified: Option<DateTime<Utc>>,
    pub size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ResourceUpsertOutput {
    Created {
        resource: String,
    },
    Changed {
        resource: String,
        previous_digest: String,
    },
    Unchanged {
        resource: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourceGetInput {
    pub locator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ResourceGetOutput {
    Ok {
        resource: String,
        kind: String,
        digest: String,
    },
    NotFound {
        locator: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourceListInput {
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ResourceListOutput {
    Ok {
        resources: Vec<{ locator: String, kind: String, digest: String }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourceRemoveInput {
    pub locator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ResourceRemoveOutput {
    Ok {
        resource: String,
    },
    NotFound {
        locator: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourceDiffInput {
    pub locator: String,
    pub old_digest: String,
    pub new_digest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ResourceDiffOutput {
    Ok {
        change_type: String,
    },
    Unknown {
        message: String,
    },
}

