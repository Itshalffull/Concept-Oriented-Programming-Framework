// generated: test_selection/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestSelectionAnalyzeInput {
    pub changed_sources: Vec<String>,
    pub test_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TestSelectionAnalyzeOutput {
    Ok {
        affected_tests: Vec<{ test_id: String, language: String, test_type: String, relevance: f64, reason: String }>,
    },
    NoMappings {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestSelectionSelectInput {
    pub affected_tests: Vec<{ test_id: String, language: String, test_type: String, relevance: f64 }>,
    pub budget: Option<{ max_duration: i64, max_tests: i64 }>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TestSelectionSelectOutput {
    Ok {
        selected: Vec<{ test_id: String, language: String, test_type: String, priority: i64 }>,
        estimated_duration: i64,
        confidence: f64,
    },
    BudgetInsufficient {
        selected: Vec<{ test_id: String }>,
        missed_tests: i64,
        confidence: f64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestSelectionRecordInput {
    pub test_id: String,
    pub language: String,
    pub test_type: String,
    pub covered_sources: Vec<String>,
    pub duration: i64,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TestSelectionRecordOutput {
    Ok {
        mapping: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestSelectionStatisticsInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum TestSelectionStatisticsOutput {
    Ok {
        stats: { total_mappings: i64, avg_selection_ratio: f64, avg_confidence: f64, last_updated: DateTime<Utc> },
    },
}

