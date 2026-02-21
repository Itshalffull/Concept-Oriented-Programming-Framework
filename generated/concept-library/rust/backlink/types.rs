// generated: backlink/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BacklinkGetBacklinksInput {
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BacklinkGetBacklinksOutput {
    Ok {
        sources: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BacklinkGetUnlinkedMentionsInput {
    pub entity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BacklinkGetUnlinkedMentionsOutput {
    Ok {
        mentions: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BacklinkReindexInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BacklinkReindexOutput {
    Ok {
        count: i64,
    },
}

