// generated: data_quality/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataQualityValidateInput {
    pub item: String,
    pub ruleset_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataQualityValidateOutput {
    Ok {
        valid: String,
        score: String,
    },
    Invalid {
        violations: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataQualityQuarantineInput {
    pub item_id: String,
    pub violations: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataQualityQuarantineOutput {
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataQualityReleaseInput {
    pub item_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataQualityReleaseOutput {
    Ok,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataQualityProfileInput {
    pub dataset_query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataQualityProfileOutput {
    Ok {
        profile: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DataQualityReconcileInput {
    pub field: String,
    pub knowledge_base: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DataQualityReconcileOutput {
    Ok {
        matches: String,
    },
}

