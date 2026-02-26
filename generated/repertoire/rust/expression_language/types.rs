// generated: expression_language/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionLanguageRegisterLanguageInput {
    pub name: String,
    pub grammar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExpressionLanguageRegisterLanguageOutput {
    Ok,
    Exists,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionLanguageRegisterFunctionInput {
    pub name: String,
    pub implementation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExpressionLanguageRegisterFunctionOutput {
    Ok,
    Exists,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionLanguageRegisterOperatorInput {
    pub name: String,
    pub implementation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExpressionLanguageRegisterOperatorOutput {
    Ok,
    Exists,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionLanguageParseInput {
    pub expression: String,
    pub text: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExpressionLanguageParseOutput {
    Ok {
        ast: String,
    },
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionLanguageEvaluateInput {
    pub expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExpressionLanguageEvaluateOutput {
    Ok {
        result: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionLanguageTypeCheckInput {
    pub expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExpressionLanguageTypeCheckOutput {
    Ok {
        valid: bool,
        errors: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExpressionLanguageGetCompletionsInput {
    pub expression: String,
    pub cursor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ExpressionLanguageGetCompletionsOutput {
    Ok {
        completions: String,
    },
    Notfound,
}

