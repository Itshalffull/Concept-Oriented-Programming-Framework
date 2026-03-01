// generated: analysis_rule/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisRuleCreateInput {
    pub name: String,
    pub engine: String,
    pub source: String,
    pub severity: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnalysisRuleCreateOutput {
    Ok {
        rule: String,
    },
    InvalidSyntax {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisRuleEvaluateInput {
    pub rule: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnalysisRuleEvaluateOutput {
    Ok {
        findings: String,
    },
    NoFindings,
    EvaluationError {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisRuleEvaluateAllInput {
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnalysisRuleEvaluateAllOutput {
    Ok {
        results: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisRuleGetInput {
    pub rule: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum AnalysisRuleGetOutput {
    Ok {
        rule: String,
        name: String,
        engine: String,
        severity: String,
        category: String,
    },
    Notfound,
}

