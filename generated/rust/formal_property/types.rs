// generated: formal_property/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertyDefineInput {
    pub target_symbol: String,
    pub kind: String,
    pub property_text: String,
    pub formal_language: String,
    pub scope: String,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertyDefineOutput {
    Ok {
        property: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertyProveInput {
    pub property: String,
    pub evidence_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertyProveOutput {
    Ok {
        property: String,
        evidence: String,
    },
    Notfound {
        property: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertyRefuteInput {
    pub property: String,
    pub evidence_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertyRefuteOutput {
    Ok {
        property: String,
        counterexample: String,
    },
    Notfound {
        property: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertyCheckInput {
    pub property: String,
    pub solver: String,
    pub timeout_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertyCheckOutput {
    Ok {
        property: String,
        status: String,
    },
    Timeout {
        property: String,
        elapsed_ms: i64,
    },
    Unknown {
        property: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertySynthesizeInput {
    pub target_symbol: String,
    pub intent_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertySynthesizeOutput {
    Ok {
        properties: Vec<String>,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertyCoverageInput {
    pub target_symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertyCoverageOutput {
    Ok {
        total: i64,
        proved: i64,
        refuted: i64,
        unknown: i64,
        timeout: i64,
        coverage_pct: f64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertyListInput {
    pub target_symbol: Option<String>,
    pub kind: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertyListOutput {
    Ok {
        properties: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FormalPropertyInvalidateInput {
    pub property: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FormalPropertyInvalidateOutput {
    Ok {
        property: String,
    },
    Notfound {
        property: String,
    },
}
