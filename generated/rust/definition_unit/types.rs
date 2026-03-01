// generated: definition_unit/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DefinitionUnitExtractInput {
    pub tree: String,
    pub start_byte: i64,
    pub end_byte: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DefinitionUnitExtractOutput {
    Ok {
        unit: String,
    },
    NotADefinition {
        node_type: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DefinitionUnitFindBySymbolInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DefinitionUnitFindBySymbolOutput {
    Ok {
        unit: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DefinitionUnitFindByPatternInput {
    pub kind: String,
    pub language: String,
    pub name_pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DefinitionUnitFindByPatternOutput {
    Ok {
        units: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DefinitionUnitDiffInput {
    pub a: String,
    pub b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DefinitionUnitDiffOutput {
    Ok {
        changes: String,
    },
    Same,
}

