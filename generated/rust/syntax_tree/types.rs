// generated: syntax_tree/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyntaxTreeParseInput {
    pub file: String,
    pub grammar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyntaxTreeParseOutput {
    Ok {
        tree: String,
    },
    ParseError {
        tree: String,
        error_count: i64,
    },
    NoGrammar {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyntaxTreeReparseInput {
    pub tree: String,
    pub start_byte: i64,
    pub old_end_byte: i64,
    pub new_end_byte: i64,
    pub new_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyntaxTreeReparseOutput {
    Ok {
        tree: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyntaxTreeQueryInput {
    pub tree: String,
    pub pattern: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyntaxTreeQueryOutput {
    Ok {
        matches: String,
    },
    InvalidPattern {
        message: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyntaxTreeNodeAtInput {
    pub tree: String,
    pub byte_offset: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyntaxTreeNodeAtOutput {
    Ok {
        node_type: String,
        start_byte: i64,
        end_byte: i64,
        named: String,
        field: String,
    },
    OutOfRange,
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyntaxTreeGetInput {
    pub tree: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum SyntaxTreeGetOutput {
    Ok {
        tree: String,
        source: String,
        grammar: String,
        byte_length: i64,
        edit_version: i64,
        error_ranges: String,
    },
    Notfound {
        message: String,
    },
}

