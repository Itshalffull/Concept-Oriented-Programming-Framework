// generated: content_digest/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentDigestComputeInput {
    pub unit: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentDigestComputeOutput {
    Ok {
        digest: String,
    },
    UnsupportedAlgorithm {
        algorithm: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentDigestLookupInput {
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentDigestLookupOutput {
    Ok {
        units: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContentDigestEquivalentInput {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContentDigestEquivalentOutput {
    Yes,
    No {
        diff_summary: String,
    },
}

