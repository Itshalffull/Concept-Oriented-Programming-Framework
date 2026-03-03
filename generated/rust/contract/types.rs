// generated: contract/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractDefineInput {
    pub name: String,
    pub source_concept: String,
    pub target_concept: String,
    pub assumptions: Vec<String>,
    pub guarantees: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractDefineOutput {
    Ok {
        contract: String,
    },
    Invalid {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractVerifyInput {
    pub contract: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractVerifyOutput {
    Ok {
        contract: String,
        compatible: bool,
    },
    Incompatible {
        contract: String,
        violations: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractComposeInput {
    pub contracts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractComposeOutput {
    Ok {
        composed: String,
        transitive_guarantees: Vec<String>,
    },
    Incompatible {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractDischargeInput {
    pub contract: String,
    pub assumption_ref: String,
    pub evidence_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractDischargeOutput {
    Ok {
        contract: String,
        remaining: Vec<String>,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ContractListInput {
    pub source_concept: Option<String>,
    pub target_concept: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ContractListOutput {
    Ok {
        contracts: Vec<String>,
    },
}
