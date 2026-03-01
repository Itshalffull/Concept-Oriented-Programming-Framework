// generated: deploy_plan/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeployPlanPlanInput {
    pub manifest: String,
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployPlanPlanOutput {
    Ok {
        plan: String,
        graph: String,
        estimated_duration: i64,
    },
    InvalidManifest {
        errors: Vec<String>,
    },
    IncompleteGraph {
        missing: Vec<String>,
    },
    CircularDependency {
        cycle: Vec<String>,
    },
    TransportMismatch {
        details: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeployPlanValidateInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployPlanValidateOutput {
    Ok {
        plan: String,
        warnings: Vec<String>,
    },
    MigrationRequired {
        plan: String,
        concepts: Vec<String>,
        from_versions: Vec<i64>,
        to_versions: Vec<i64>,
    },
    SchemaIncompatible {
        details: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeployPlanExecuteInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployPlanExecuteOutput {
    Ok {
        plan: String,
        duration: i64,
        nodes_deployed: i64,
    },
    Partial {
        plan: String,
        deployed: Vec<String>,
        failed: Vec<String>,
    },
    RollbackTriggered {
        plan: String,
        reason: String,
        rolled_back: Vec<String>,
    },
    RollbackFailed {
        plan: String,
        reason: String,
        stuck: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeployPlanRollbackInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployPlanRollbackOutput {
    Ok {
        plan: String,
        rolled_back: Vec<String>,
    },
    Partial {
        plan: String,
        rolled_back: Vec<String>,
        stuck: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DeployPlanStatusInput {
    pub plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum DeployPlanStatusOutput {
    Ok {
        plan: String,
        phase: String,
        progress: f64,
        active_nodes: Vec<String>,
    },
    Notfound {
        plan: String,
    },
}

