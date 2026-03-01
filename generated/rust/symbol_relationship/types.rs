// generated: symbol_relationship/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolRelationshipAddInput {
    pub source: String,
    pub target: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolRelationshipAddOutput {
    Ok {
        relationship: String,
    },
    AlreadyExists {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolRelationshipFindFromInput {
    pub source: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolRelationshipFindFromOutput {
    Ok {
        relationships: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolRelationshipFindToInput {
    pub target: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolRelationshipFindToOutput {
    Ok {
        relationships: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolRelationshipTransitiveClosureInput {
    pub start: String,
    pub kind: String,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolRelationshipTransitiveClosureOutput {
    Ok {
        symbols: String,
        paths: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolRelationshipGetInput {
    pub relationship: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolRelationshipGetOutput {
    Ok {
        relationship: String,
        source: String,
        target: String,
        kind: String,
        metadata: String,
    },
    Notfound,
}

