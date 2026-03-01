// generated: language_grammar/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LanguageGrammarRegisterInput {
    pub name: String,
    pub extensions: String,
    pub parser_wasm_path: String,
    pub node_types: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LanguageGrammarRegisterOutput {
    Ok {
        grammar: String,
    },
    AlreadyRegistered {
        existing: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LanguageGrammarResolveInput {
    pub file_extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LanguageGrammarResolveOutput {
    Ok {
        grammar: String,
    },
    NoGrammar {
        extension: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LanguageGrammarResolveByMimeInput {
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LanguageGrammarResolveByMimeOutput {
    Ok {
        grammar: String,
    },
    NoGrammar {
        mime_type: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LanguageGrammarGetInput {
    pub grammar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LanguageGrammarGetOutput {
    Ok {
        grammar: String,
        name: String,
        extensions: String,
        parser_wasm_path: String,
    },
    Notfound {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LanguageGrammarListInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LanguageGrammarListOutput {
    Ok {
        grammars: String,
    },
}

