// generated: runtime_coverage/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageRecordInput {
    pub symbol: String,
    pub kind: String,
    pub flow_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageRecordOutput {
    Ok {
        entry: String,
    },
    Created {
        entry: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageCoverageReportInput {
    pub kind: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageCoverageReportOutput {
    Ok {
        report: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageVariantCoverageInput {
    pub concept: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageVariantCoverageOutput {
    Ok {
        report: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageSyncCoverageInput {
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageSyncCoverageOutput {
    Ok {
        report: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageWidgetStateCoverageInput {
    pub widget: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageWidgetStateCoverageOutput {
    Ok {
        report: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageWidgetLifecycleReportInput {
    pub widget: String,
    pub since: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageWidgetLifecycleReportOutput {
    Ok {
        report: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageWidgetRenderTraceInput {
    pub widget_instance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageWidgetRenderTraceOutput {
    Ok {
        renders: String,
    },
    Notfound,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageWidgetComparisonInput {
    pub since: String,
    pub top_n: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageWidgetComparisonOutput {
    Ok {
        ranking: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCoverageDeadAtRuntimeInput {
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum RuntimeCoverageDeadAtRuntimeOutput {
    Ok {
        never_exercised: String,
    },
}

