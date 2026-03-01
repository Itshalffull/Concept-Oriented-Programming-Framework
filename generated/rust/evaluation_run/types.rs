// generated: evaluation_run/types.rs
// Quality evaluation execution against step outputs with metric tracking.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluationRunRunEvalInput {
    pub step_ref: String,
    pub evaluator_type: String,
    pub input: serde_json::Value,
    pub threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvaluationRunRunEvalOutput {
    Ok {
        eval_id: String,
        step_ref: String,
        evaluator_type: String,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluationRunLogMetricInput {
    pub eval_id: String,
    pub metric_name: String,
    pub metric_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvaluationRunLogMetricOutput {
    Ok {
        eval_id: String,
    },
    NotFound {
        eval_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluationRunPassInput {
    pub eval_id: String,
    pub score: f64,
    pub feedback: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvaluationRunPassOutput {
    Ok {
        eval_id: String,
        step_ref: String,
        status: String,
    },
    NotFound {
        eval_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluationRunFailInput {
    pub eval_id: String,
    pub score: f64,
    pub feedback: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvaluationRunFailOutput {
    Failed {
        eval_id: String,
        step_ref: String,
        feedback: String,
    },
    NotFound {
        eval_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluationRunGetResultInput {
    pub eval_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum EvaluationRunGetResultOutput {
    Ok {
        eval_id: String,
        status: String,
        score: f64,
        feedback: String,
    },
    NotFound {
        eval_id: String,
    },
}
