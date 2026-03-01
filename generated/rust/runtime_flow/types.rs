// generated: runtime_flow/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowCorrelateInput {
    pub flow_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowCorrelateOutput {
    Ok {
        flow: String,
    },
    Partial {
        flow: String,
        unresolved: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowFindByActionInput {
    pub action: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowFindByActionOutput {
    Ok {
        flows: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowFindBySyncInput {
    pub sync: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowFindBySyncOutput {
    Ok {
        flows: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowFindByVariantInput {
    pub variant: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowFindByVariantOutput {
    Ok {
        flows: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowFindFailuresInput {
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowFindFailuresOutput {
    Ok {
        flows: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowCompareToStaticInput {
    pub flow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowCompareToStaticOutput {
    Matches {
        path_length: i64,
    },
    Deviates {
        deviations: String,
    },
    NoStaticPath,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowSourceLocationsInput {
    pub flow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowSourceLocationsOutput {
    Ok {
        locations: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeFlowGetInput {
    pub flow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeFlowGetOutput {
    Ok {
        flow: String,
        flow_id: String,
        status: String,
        step_count: i64,
        deviation_count: i64,
    },
    Notfound,
}

