// generated: program_slice/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgramSliceComputeInput {
    pub criterion: String,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgramSliceComputeOutput {
    Ok {
        slice: String,
    },
    NoDependenceData {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgramSliceFilesInSliceInput {
    pub slice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgramSliceFilesInSliceOutput {
    Ok {
        files: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgramSliceSymbolsInSliceInput {
    pub slice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgramSliceSymbolsInSliceOutput {
    Ok {
        symbols: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProgramSliceGetInput {
    pub slice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProgramSliceGetOutput {
    Ok {
        slice: String,
        criterion_symbol: String,
        direction: String,
        symbol_count: i64,
        file_count: i64,
        edge_count: i64,
    },
    Notfound,
}

