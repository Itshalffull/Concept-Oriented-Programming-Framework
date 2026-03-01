// generated: process_metric/types.rs
// Process-level performance metrics for dashboards, SLA monitoring, and process mining.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessMetricRecordInput {
    pub metric_name: String,
    pub metric_value: f64,
    pub dimensions: serde_json::Value,
    pub run_ref: Option<String>,
    pub spec_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessMetricRecordOutput {
    Ok {
        metric_id: String,
        metric_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessMetricQueryInput {
    pub metric_name: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessMetricQueryOutput {
    Ok {
        metrics: Vec<serde_json::Value>,
        count: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProcessMetricAggregateInput {
    pub metric_name: String,
    pub aggregation: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ProcessMetricAggregateOutput {
    Ok {
        value: f64,
        sample_count: i64,
    },
}
