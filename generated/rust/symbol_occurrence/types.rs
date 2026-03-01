// generated: symbol_occurrence/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolOccurrenceRecordInput {
    pub symbol: String,
    pub file: String,
    pub start_row: i64,
    pub start_col: i64,
    pub end_row: i64,
    pub end_col: i64,
    pub start_byte: i64,
    pub end_byte: i64,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolOccurrenceRecordOutput {
    Ok {
        occurrence: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolOccurrenceFindDefinitionsInput {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolOccurrenceFindDefinitionsOutput {
    Ok {
        occurrences: String,
    },
    NoDefinitions,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolOccurrenceFindReferencesInput {
    pub symbol: String,
    pub role_filter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolOccurrenceFindReferencesOutput {
    Ok {
        occurrences: String,
    },
    NoReferences,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolOccurrenceFindAtPositionInput {
    pub file: String,
    pub row: i64,
    pub col: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolOccurrenceFindAtPositionOutput {
    Ok {
        occurrence: String,
        symbol: String,
    },
    NoSymbolAtPosition,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SymbolOccurrenceFindInFileInput {
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SymbolOccurrenceFindInFileOutput {
    Ok {
        occurrences: String,
    },
}

