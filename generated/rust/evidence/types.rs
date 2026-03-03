// generated: evidence/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceRecordInput {
    pub artifact_type: String,
    pub content: Vec<u8>,
    pub solver_metadata: Vec<u8>,
    pub property_ref: String,
    pub confidence_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvidenceRecordOutput {
    Ok {
        evidence: String,
        content_hash: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceValidateInput {
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvidenceValidateOutput {
    Ok {
        evidence: String,
        valid: bool,
    },
    Corrupted {
        evidence: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceRetrieveInput {
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvidenceRetrieveOutput {
    Ok {
        evidence: String,
        content: Vec<u8>,
        metadata: Vec<u8>,
    },
    Notfound {
        evidence: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceCompareInput {
    pub evidence1: String,
    pub evidence2: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvidenceCompareOutput {
    Ok {
        identical: bool,
        diff: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceMinimizeInput {
    pub evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvidenceMinimizeOutput {
    Ok {
        minimized: String,
        reduction_pct: f64,
    },
    Not_applicable {
        evidence: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceListInput {
    pub property_ref: Option<String>,
    pub artifact_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvidenceListOutput {
    Ok {
        evidence: Vec<String>,
    },
}
