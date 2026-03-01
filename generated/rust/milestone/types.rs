// generated: milestone/types.rs
// Declarative process goal tracking without prescribing specific steps.
// See Architecture doc Sections 16.11, 16.12

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MilestoneDefineInput {
    pub run_ref: String,
    pub name: String,
    pub condition_expr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MilestoneDefineOutput {
    Ok {
        milestone_id: String,
        name: String,
        status: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MilestoneEvaluateInput {
    pub milestone_id: String,
    pub context: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MilestoneEvaluateOutput {
    Achieved {
        milestone_id: String,
        name: String,
        run_ref: String,
    },
    NotYet {
        milestone_id: String,
    },
    AlreadyAchieved {
        milestone_id: String,
    },
    NotFound {
        milestone_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MilestoneRevokeInput {
    pub milestone_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum MilestoneRevokeOutput {
    Ok {
        milestone_id: String,
        status: String,
    },
    NotFound {
        milestone_id: String,
    },
}
