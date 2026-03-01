// generated: symbol/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolRegisterInput {
    pub symbol_string: String,
    pub kind: String,
    pub display_name: String,
    pub defining_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolRegisterOutput {
    Ok {
        symbol: String,
    },
    AlreadyExists {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolResolveInput {
    pub symbol_string: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolResolveOutput {
    Ok {
        symbol: String,
    },
    Notfound,
    Ambiguous {
        candidates: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolFindByKindInput {
    pub kind: String,
    pub namespace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolFindByKindOutput {
    Ok {
        symbols: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolFindByFileInput {
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolFindByFileOutput {
    Ok {
        symbols: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolRenameInput {
    pub symbol: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolRenameOutput {
    Ok {
        old_name: String,
        occurrences_updated: i64,
    },
    Conflict {
        conflicting: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolGetInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolGetOutput {
    Ok {
        symbol: String,
        symbol_string: String,
        kind: String,
        display_name: String,
        visibility: String,
        defining_file: String,
        namespace: String,
    },
    Notfound,
}

