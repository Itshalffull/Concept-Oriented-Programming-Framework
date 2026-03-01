// generated: builder/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuilderBuildInput {
    pub concept: String,
    pub source: String,
    pub language: String,
    pub platform: String,
    pub config: { mode: String, features: Option<Vec<String>> },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuilderBuildOutput {
    Ok {
        build: String,
        artifact_hash: String,
        artifact_location: String,
        duration: i64,
    },
    CompilationError {
        concept: String,
        language: String,
        errors: Vec<{ file: String, line: i64, message: String }>,
    },
    TestFailure {
        concept: String,
        language: String,
        passed: i64,
        failed: i64,
        failures: Vec<{ test: String, message: String }>,
    },
    ToolchainError {
        concept: String,
        language: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuilderBuildAllInput {
    pub concepts: Vec<String>,
    pub source: String,
    pub targets: Vec<{ language: String, platform: String }>,
    pub config: { mode: String, features: Option<Vec<String>> },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuilderBuildAllOutput {
    Ok {
        results: Vec<{ concept: String, language: String, artifact_hash: String, duration: i64 }>,
    },
    Partial {
        completed: Vec<{ concept: String, language: String, artifact_hash: String }>,
        failed: Vec<{ concept: String, language: String, error: String }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuilderTestInput {
    pub concept: String,
    pub language: String,
    pub platform: String,
    pub test_filter: Option<Vec<String>>,
    pub test_type: Option<String>,
    pub tool_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuilderTestOutput {
    Ok {
        passed: i64,
        failed: i64,
        skipped: i64,
        duration: i64,
        test_type: String,
    },
    TestFailure {
        passed: i64,
        failed: i64,
        failures: Vec<{ test: String, message: String }>,
        test_type: String,
    },
    NotBuilt {
        concept: String,
        language: String,
    },
    RunnerNotFound {
        language: String,
        test_type: String,
        install_hint: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuilderStatusInput {
    pub build: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuilderStatusOutput {
    Ok {
        build: String,
        status: String,
        duration: Option<i64>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BuilderHistoryInput {
    pub concept: String,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum BuilderHistoryOutput {
    Ok {
        builds: Vec<{ language: String, platform: String, artifact_hash: String, duration: i64, completed_at: DateTime<Utc>, tests_passed: i64 }>,
    },
}

