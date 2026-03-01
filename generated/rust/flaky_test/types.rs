// generated: flaky_test/types.rs

use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlakyTestRecordInput {
    pub test_id: String,
    pub language: String,
    pub builder: String,
    pub test_type: String,
    pub passed: bool,
    pub duration: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlakyTestRecordOutput {
    Ok {
        test: String,
    },
    FlakyDetected {
        test: String,
        flip_count: i64,
        recent_results: Vec<bool>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlakyTestQuarantineInput {
    pub test_id: String,
    pub reason: String,
    pub owner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlakyTestQuarantineOutput {
    Ok {
        test: String,
    },
    AlreadyQuarantined {
        test: String,
    },
    NotFound {
        test_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlakyTestReleaseInput {
    pub test_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlakyTestReleaseOutput {
    Ok {
        test: String,
    },
    NotQuarantined {
        test: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlakyTestIsQuarantinedInput {
    pub test_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlakyTestIsQuarantinedOutput {
    Yes {
        test: String,
        reason: String,
        owner: Option<String>,
        quarantined_at: DateTime<Utc>,
    },
    No {
        test: String,
    },
    Unknown {
        test_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlakyTestReportInput {
    pub test_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlakyTestReportOutput {
    Ok {
        summary: { total_tracked: i64, currently_flaky: i64, quarantined: i64, stabilized: i64, top_flaky: Vec<{ test_id: String, language: String, test_type: String, flip_count: i64, owner: Option<String> }> },
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlakyTestSetPolicyInput {
    pub flip_threshold: Option<i64>,
    pub flip_window: Option<String>,
    pub auto_quarantine: Option<bool>,
    pub retry_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FlakyTestSetPolicyOutput {
    Ok,
}

