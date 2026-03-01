// generated: scope_graph/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScopeGraphBuildInput {
    pub file: String,
    pub tree: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScopeGraphBuildOutput {
    Ok {
        graph: String,
    },
    UnsupportedLanguage {
        language: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScopeGraphResolveReferenceInput {
    pub graph: String,
    pub scope: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScopeGraphResolveReferenceOutput {
    Ok {
        symbol: String,
    },
    Unresolved {
        candidates: String,
    },
    Ambiguous {
        symbols: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScopeGraphVisibleSymbolsInput {
    pub graph: String,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScopeGraphVisibleSymbolsOutput {
    Ok {
        symbols: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScopeGraphResolveCrossFileInput {
    pub graph: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScopeGraphResolveCrossFileOutput {
    Ok {
        resolved_count: i64,
    },
    NoUnresolved,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScopeGraphGetInput {
    pub graph: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ScopeGraphGetOutput {
    Ok {
        graph: String,
        file: String,
        scope_count: i64,
        declaration_count: i64,
        unresolved_count: i64,
    },
    Notfound,
}

