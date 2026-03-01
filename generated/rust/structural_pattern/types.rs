// generated: structural_pattern/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StructuralPatternCreateInput {
    pub syntax: String,
    pub source: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StructuralPatternCreateOutput {
    Ok {
        pattern: String,
    },
    InvalidSyntax {
        message: String,
        position: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StructuralPatternMatchInput {
    pub pattern: String,
    pub tree: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StructuralPatternMatchOutput {
    Ok {
        matches: String,
    },
    NoMatches,
    IncompatibleLanguage {
        pattern_lang: String,
        tree_lang: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StructuralPatternMatchProjectInput {
    pub pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum StructuralPatternMatchProjectOutput {
    Ok {
        results: String,
    },
    NoMatches,
}

