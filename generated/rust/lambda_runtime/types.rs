// generated: lambda_runtime/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LambdaRuntimeProvisionInput {
    pub concept: String,
    pub memory: i64,
    pub timeout: i64,
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LambdaRuntimeProvisionOutput {
    Ok {
        function: String,
        function_arn: String,
        endpoint: String,
    },
    QuotaExceeded {
        region: String,
        limit: String,
    },
    IamError {
        policy: String,
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LambdaRuntimeDeployInput {
    pub function: String,
    pub artifact_location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LambdaRuntimeDeployOutput {
    Ok {
        function: String,
        version: String,
    },
    PackageTooLarge {
        function: String,
        size_bytes: i64,
        limit_bytes: i64,
    },
    RuntimeUnsupported {
        function: String,
        runtime: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LambdaRuntimeSetTrafficWeightInput {
    pub function: String,
    pub alias_weight: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LambdaRuntimeSetTrafficWeightOutput {
    Ok {
        function: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LambdaRuntimeRollbackInput {
    pub function: String,
    pub target_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LambdaRuntimeRollbackOutput {
    Ok {
        function: String,
        restored_version: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LambdaRuntimeDestroyInput {
    pub function: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum LambdaRuntimeDestroyOutput {
    Ok {
        function: String,
    },
    ResourceInUse {
        function: String,
        dependents: Vec<String>,
    },
}

