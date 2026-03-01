// generated: generation_plan/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationPlanBeginInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GenerationPlanBeginOutput {
    Ok {
        run: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationPlanRecordStepInput {
    pub step_key: String,
    pub status: String,
    pub files_produced: Option<i64>,
    pub duration: Option<i64>,
    pub cached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GenerationPlanRecordStepOutput {
    Ok,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationPlanCompleteInput {
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GenerationPlanCompleteOutput {
    Ok {
        run: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationPlanStatusInput {
    pub run: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GenerationPlanStatusOutput {
    Ok {
        steps: Vec<{ step_key: String, status: String, duration: i64, cached: bool, files_produced: i64 }>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationPlanSummaryInput {
    pub run: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GenerationPlanSummaryOutput {
    Ok {
        total: i64,
        executed: i64,
        cached: i64,
        failed: i64,
        total_duration: i64,
        files_produced: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GenerationPlanHistoryInput {
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum GenerationPlanHistoryOutput {
    Ok {
        runs: Vec<{ run: String, started_at: DateTime<Utc>, completed_at: Option<DateTime<Utc>>, total: i64, executed: i64, cached: i64, failed: i64 }>,
    },
}

