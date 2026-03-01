// AWS Lambda runtime implementation
// Manages Lambda function deployments: function configurations,
// IAM roles, API Gateway routes, layer versions, and cold start metrics.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::LambdaRuntimeHandler;
use serde_json::json;

pub struct LambdaRuntimeHandlerImpl;

#[async_trait]
impl LambdaRuntimeHandler for LambdaRuntimeHandlerImpl {
    async fn provision(
        &self,
        input: LambdaRuntimeProvisionInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeProvisionOutput, Box<dyn std::error::Error>> {
        if input.region.contains("quota-exceeded") {
            return Ok(LambdaRuntimeProvisionOutput::QuotaExceeded {
                region: input.region,
                limit: "1000 concurrent executions".into(),
            });
        }

        if input.region.contains("iam-error") {
            return Ok(LambdaRuntimeProvisionOutput::IamError {
                policy: format!("lambda-role-{}", input.concept.to_lowercase()),
                reason: "IAM role creation failed due to insufficient permissions".into(),
            });
        }

        let concept_lower = input.concept.to_lowercase();
        let now = chrono::Utc::now().timestamp_millis();
        let function_id = format!("lambda-{}-{}", concept_lower, now);
        let function_name = format!("{}-fn", concept_lower);
        let function_arn = format!(
            "arn:aws:lambda:{}:123456789012:function:{}",
            input.region, function_name
        );
        let endpoint = format!(
            "https://{}.execute-api.{}.amazonaws.com/prod",
            function_name, input.region
        );

        storage.put("function", &function_id, json!({
            "functionArn": function_arn,
            "roleArn": format!("arn:aws:iam::123456789012:role/{}-role", function_name),
            "memory": input.memory,
            "timeout": input.timeout,
            "runtime": "nodejs20.x",
            "layers": "[]",
            "apiGatewayRoute": format!("/prod/{}", concept_lower),
            "coldStartMs": null,
            "lastInvokedAt": null,
            "currentVersion": "0",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        })).await?;

        Ok(LambdaRuntimeProvisionOutput::Ok {
            function: function_id,
            function_arn,
            endpoint,
        })
    }

    async fn deploy(
        &self,
        input: LambdaRuntimeDeployInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeDeployOutput, Box<dyn std::error::Error>> {
        let record = match storage.get("function", &input.function).await? {
            Some(r) => r,
            None => {
                return Ok(LambdaRuntimeDeployOutput::PackageTooLarge {
                    function: input.function,
                    size_bytes: 0,
                    limit_bytes: 262144000,
                });
            }
        };

        if input.artifact_location.contains("toolarge") {
            return Ok(LambdaRuntimeDeployOutput::PackageTooLarge {
                function: input.function,
                size_bytes: 300000000,
                limit_bytes: 262144000,
            });
        }

        if input.artifact_location.contains("unsupported-runtime") {
            let runtime = record.get("runtime")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            return Ok(LambdaRuntimeDeployOutput::RuntimeUnsupported {
                function: input.function,
                runtime,
            });
        }

        let current_version = record.get("currentVersion")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        let new_version = (current_version + 1).to_string();

        let mut updated = record.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("currentVersion".into(), json!(new_version));
            obj.insert("lastDeployedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
        }
        storage.put("function", &input.function, updated).await?;

        Ok(LambdaRuntimeDeployOutput::Ok {
            function: input.function,
            version: new_version,
        })
    }

    async fn set_traffic_weight(
        &self,
        input: LambdaRuntimeSetTrafficWeightInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeSetTrafficWeightOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("function", &input.function).await? {
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("aliasWeight".into(), json!(input.alias_weight));
            }
            storage.put("function", &input.function, updated).await?;
        }

        Ok(LambdaRuntimeSetTrafficWeightOutput::Ok {
            function: input.function,
        })
    }

    async fn rollback(
        &self,
        input: LambdaRuntimeRollbackInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeRollbackOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("function", &input.function).await? {
            let mut updated = record.clone();
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("currentVersion".into(), json!(input.target_version));
                obj.insert("lastDeployedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
            }
            storage.put("function", &input.function, updated).await?;
        }

        Ok(LambdaRuntimeRollbackOutput::Ok {
            function: input.function,
            restored_version: input.target_version,
        })
    }

    async fn destroy(
        &self,
        input: LambdaRuntimeDestroyInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LambdaRuntimeDestroyOutput, Box<dyn std::error::Error>> {
        if let Some(record) = storage.get("function", &input.function).await? {
            if let Some(deps) = record.get("dependents").and_then(|v| v.as_array()) {
                if !deps.is_empty() {
                    let dependents: Vec<String> = deps.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();
                    return Ok(LambdaRuntimeDestroyOutput::ResourceInUse {
                        function: input.function,
                        dependents,
                    });
                }
            }
        }

        storage.del("function", &input.function).await?;

        Ok(LambdaRuntimeDestroyOutput::Ok {
            function: input.function,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_provision_success() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let result = handler.provision(
            LambdaRuntimeProvisionInput {
                concept: "MyFunc".into(),
                memory: 256,
                timeout: 30,
                region: "us-east-1".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeProvisionOutput::Ok { function, function_arn, endpoint } => {
                assert!(function.contains("lambda-myfunc"));
                assert!(function_arn.contains("us-east-1"));
                assert!(endpoint.contains("execute-api"));
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_provision_quota_exceeded() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let result = handler.provision(
            LambdaRuntimeProvisionInput {
                concept: "Func".into(),
                memory: 128,
                timeout: 10,
                region: "quota-exceeded-region".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeProvisionOutput::QuotaExceeded { .. } => {}
            _ => panic!("Expected QuotaExceeded variant"),
        }
    }

    #[tokio::test]
    async fn test_provision_iam_error() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let result = handler.provision(
            LambdaRuntimeProvisionInput {
                concept: "Func".into(),
                memory: 128,
                timeout: 10,
                region: "iam-error-region".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeProvisionOutput::IamError { .. } => {}
            _ => panic!("Expected IamError variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_success() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let prov = handler.provision(
            LambdaRuntimeProvisionInput {
                concept: "Svc".into(), memory: 128, timeout: 10, region: "us-west-2".into(),
            },
            &storage,
        ).await.unwrap();
        let fn_id = match prov {
            LambdaRuntimeProvisionOutput::Ok { function, .. } => function,
            _ => panic!("Expected Ok"),
        };

        let result = handler.deploy(
            LambdaRuntimeDeployInput {
                function: fn_id.clone(),
                artifact_location: "s3://bucket/code.zip".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeDeployOutput::Ok { function, version } => {
                assert_eq!(function, fn_id);
                assert_eq!(version, "1");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_deploy_package_too_large() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let prov = handler.provision(
            LambdaRuntimeProvisionInput {
                concept: "X".into(), memory: 128, timeout: 10, region: "us-east-1".into(),
            },
            &storage,
        ).await.unwrap();
        let fn_id = match prov {
            LambdaRuntimeProvisionOutput::Ok { function, .. } => function,
            _ => panic!("Expected Ok"),
        };

        let result = handler.deploy(
            LambdaRuntimeDeployInput {
                function: fn_id,
                artifact_location: "s3://bucket/toolarge-code.zip".into(),
            },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeDeployOutput::PackageTooLarge { .. } => {}
            _ => panic!("Expected PackageTooLarge variant"),
        }
    }

    #[tokio::test]
    async fn test_set_traffic_weight() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let result = handler.set_traffic_weight(
            LambdaRuntimeSetTrafficWeightInput { function: "fn-1".into(), alias_weight: 50 },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeSetTrafficWeightOutput::Ok { function } => assert_eq!(function, "fn-1"),
        }
    }

    #[tokio::test]
    async fn test_rollback() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let result = handler.rollback(
            LambdaRuntimeRollbackInput { function: "fn-1".into(), target_version: "2".into() },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeRollbackOutput::Ok { function, restored_version } => {
                assert_eq!(function, "fn-1");
                assert_eq!(restored_version, "2");
            }
        }
    }

    #[tokio::test]
    async fn test_destroy() {
        let storage = InMemoryStorage::new();
        let handler = LambdaRuntimeHandlerImpl;
        let result = handler.destroy(
            LambdaRuntimeDestroyInput { function: "fn-1".into() },
            &storage,
        ).await.unwrap();
        match result {
            LambdaRuntimeDestroyOutput::Ok { function } => assert_eq!(function, "fn-1"),
            _ => panic!("Expected Ok variant"),
        }
    }
}
