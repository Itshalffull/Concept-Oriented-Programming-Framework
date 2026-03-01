// LLMCall concept implementation
// Manages LLM prompt execution with structured output validation,
// tool calling, and repair loops. Actual model invocation is delegated to providers.
// Status lifecycle: requesting -> validating -> accepted|rejected|repairing

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::LLMCallHandler;
use serde_json::json;

pub struct LLMCallHandlerImpl;

fn generate_call_id() -> String {
    format!("llm-{}", uuid::Uuid::new_v4())
}

#[async_trait]
impl LLMCallHandler for LLMCallHandlerImpl {
    async fn request(
        &self,
        input: LLMCallRequestInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRequestOutput, Box<dyn std::error::Error>> {
        let call_id = generate_call_id();
        let timestamp = chrono::Utc::now().to_rfc3339();

        storage.put("llm_calls", &call_id, json!({
            "call_id": call_id,
            "step_ref": input.step_ref,
            "model": input.model,
            "prompt": input.prompt,
            "output_schema": input.output_schema,
            "max_attempts": input.max_attempts,
            "attempt_count": 0,
            "status": "requesting",
            "raw_output": null,
            "validated_output": null,
            "validation_errors": null,
            "input_tokens": null,
            "output_tokens": null,
            "created_at": timestamp,
        })).await?;

        Ok(LLMCallRequestOutput::Ok {
            call_id,
            step_ref: input.step_ref,
            model: input.model,
            status: "requesting".to_string(),
        })
    }

    async fn record_response(
        &self,
        input: LLMCallRecordResponseInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRecordResponseOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("llm_calls", &input.call_id).await?;

        match existing {
            None => Ok(LLMCallRecordResponseOutput::NotFound {
                call_id: input.call_id,
            }),
            Some(record) => {
                let has_schema = record["output_schema"].as_str()
                    .map_or(false, |s| !s.is_empty());
                let new_status = if has_schema { "validating" } else { "accepted" };

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("raw_output".to_string(), json!(input.raw_output));
                    obj.insert("input_tokens".to_string(), json!(input.input_tokens));
                    obj.insert("output_tokens".to_string(), json!(input.output_tokens));
                    obj.insert("status".to_string(), json!(new_status));
                    obj.insert("responded_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                    if new_status == "accepted" {
                        obj.insert("validated_output".to_string(), json!(input.raw_output));
                    }
                }

                storage.put("llm_calls", &input.call_id, updated).await?;

                Ok(LLMCallRecordResponseOutput::Ok {
                    call_id: input.call_id,
                    status: new_status.to_string(),
                })
            }
        }
    }

    async fn validate(
        &self,
        input: LLMCallValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallValidateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("llm_calls", &input.call_id).await?;

        match existing {
            None => Ok(LLMCallValidateOutput::NotFound {
                call_id: input.call_id,
            }),
            Some(record) => {
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();
                let raw_output = record["raw_output"].clone();
                let attempt_count = record["attempt_count"].as_i64().unwrap_or(0);
                let max_attempts = record["max_attempts"].as_i64().unwrap_or(1);

                // In a real implementation, this would validate against the output_schema.
                // For the concept implementation, we accept all non-null outputs as valid.
                let is_valid = !raw_output.is_null();

                if is_valid {
                    let mut updated = record.clone();
                    if let Some(obj) = updated.as_object_mut() {
                        obj.insert("status".to_string(), json!("accepted"));
                        obj.insert("validated_output".to_string(), raw_output.clone());
                        obj.insert("validated_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                    }
                    storage.put("llm_calls", &input.call_id, updated).await?;

                    Ok(LLMCallValidateOutput::Valid {
                        call_id: input.call_id,
                        step_ref,
                        validated_output: raw_output,
                    })
                } else {
                    let errors = "Output is null or empty".to_string();
                    let mut updated = record.clone();
                    if let Some(obj) = updated.as_object_mut() {
                        obj.insert("validation_errors".to_string(), json!(errors));
                    }
                    storage.put("llm_calls", &input.call_id, updated).await?;

                    Ok(LLMCallValidateOutput::Invalid {
                        call_id: input.call_id,
                        errors,
                        attempt_count,
                        max_attempts,
                    })
                }
            }
        }
    }

    async fn repair(
        &self,
        input: LLMCallRepairInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRepairOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("llm_calls", &input.call_id).await?;

        match existing {
            None => Ok(LLMCallRepairOutput::NotFound {
                call_id: input.call_id,
            }),
            Some(record) => {
                let attempt_count = record["attempt_count"].as_i64().unwrap_or(0) + 1;
                let max_attempts = record["max_attempts"].as_i64().unwrap_or(1);
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();

                if attempt_count >= max_attempts {
                    let mut updated = record.clone();
                    if let Some(obj) = updated.as_object_mut() {
                        obj.insert("status".to_string(), json!("rejected"));
                        obj.insert("attempt_count".to_string(), json!(attempt_count));
                    }
                    storage.put("llm_calls", &input.call_id, updated).await?;

                    return Ok(LLMCallRepairOutput::MaxAttemptsReached {
                        call_id: input.call_id,
                        step_ref,
                    });
                }

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("requesting"));
                    obj.insert("attempt_count".to_string(), json!(attempt_count));
                    obj.insert("last_repair_errors".to_string(), json!(input.errors));
                }
                storage.put("llm_calls", &input.call_id, updated).await?;

                Ok(LLMCallRepairOutput::Ok {
                    call_id: input.call_id,
                    status: "requesting".to_string(),
                })
            }
        }
    }

    async fn accept(
        &self,
        input: LLMCallAcceptInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallAcceptOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("llm_calls", &input.call_id).await?;

        match existing {
            None => Ok(LLMCallAcceptOutput::NotFound {
                call_id: input.call_id,
            }),
            Some(record) => {
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();
                let raw_output = record["raw_output"].clone();

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("accepted"));
                    obj.insert("validated_output".to_string(), raw_output.clone());
                    obj.insert("accepted_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }
                storage.put("llm_calls", &input.call_id, updated).await?;

                Ok(LLMCallAcceptOutput::Ok {
                    call_id: input.call_id,
                    step_ref,
                    output: raw_output,
                })
            }
        }
    }

    async fn reject(
        &self,
        input: LLMCallRejectInput,
        storage: &dyn ConceptStorage,
    ) -> Result<LLMCallRejectOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("llm_calls", &input.call_id).await?;

        match existing {
            None => Ok(LLMCallRejectOutput::NotFound {
                call_id: input.call_id,
            }),
            Some(record) => {
                let step_ref = record["step_ref"].as_str().unwrap_or("").to_string();

                let mut updated = record.clone();
                if let Some(obj) = updated.as_object_mut() {
                    obj.insert("status".to_string(), json!("rejected"));
                    obj.insert("reject_reason".to_string(), json!(input.reason));
                    obj.insert("rejected_at".to_string(), json!(chrono::Utc::now().to_rfc3339()));
                }
                storage.put("llm_calls", &input.call_id, updated).await?;

                Ok(LLMCallRejectOutput::Ok {
                    call_id: input.call_id,
                    step_ref,
                    reason: input.reason,
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_request_creates_call() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;
        let result = handler.request(
            LLMCallRequestInput {
                step_ref: "draft-email".to_string(),
                model: "claude-sonnet".to_string(),
                prompt: json!({ "text": "Write a professional email" }),
                output_schema: Some("EmailSchema:v1".to_string()),
                max_attempts: 3,
            },
            &storage,
        ).await.unwrap();
        match result {
            LLMCallRequestOutput::Ok { call_id, step_ref, model, status } => {
                assert!(call_id.starts_with("llm-"));
                assert_eq!(step_ref, "draft-email");
                assert_eq!(model, "claude-sonnet");
                assert_eq!(status, "requesting");
            }
        }
    }

    #[tokio::test]
    async fn test_record_response_with_schema_goes_to_validating() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "gen".to_string(),
                model: "gpt-4".to_string(),
                prompt: json!("prompt"),
                output_schema: Some("Schema:v1".to_string()),
                max_attempts: 2,
            },
            &storage,
        ).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        let result = handler.record_response(
            LLMCallRecordResponseInput {
                call_id: call_id.clone(),
                raw_output: json!({ "subject": "Hello", "body": "World" }),
                input_tokens: 100,
                output_tokens: 50,
            },
            &storage,
        ).await.unwrap();
        match result {
            LLMCallRecordResponseOutput::Ok { status, .. } => {
                assert_eq!(status, "validating");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_record_response_without_schema_goes_to_accepted() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "free".to_string(),
                model: "claude".to_string(),
                prompt: json!("prompt"),
                output_schema: None,
                max_attempts: 1,
            },
            &storage,
        ).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        let result = handler.record_response(
            LLMCallRecordResponseInput {
                call_id: call_id.clone(),
                raw_output: json!("free text output"),
                input_tokens: 50,
                output_tokens: 25,
            },
            &storage,
        ).await.unwrap();
        match result {
            LLMCallRecordResponseOutput::Ok { status, .. } => {
                assert_eq!(status, "accepted");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_valid_output() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "gen".to_string(),
                model: "m".to_string(),
                prompt: json!("p"),
                output_schema: Some("S".to_string()),
                max_attempts: 3,
            },
            &storage,
        ).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        handler.record_response(
            LLMCallRecordResponseInput {
                call_id: call_id.clone(),
                raw_output: json!({ "valid": true }),
                input_tokens: 10,
                output_tokens: 5,
            },
            &storage,
        ).await.unwrap();

        let result = handler.validate(
            LLMCallValidateInput { call_id: call_id.clone() },
            &storage,
        ).await.unwrap();
        match result {
            LLMCallValidateOutput::Valid { validated_output, .. } => {
                assert_eq!(validated_output["valid"], true);
            }
            _ => panic!("Expected Valid variant"),
        }
    }

    #[tokio::test]
    async fn test_repair_increments_attempt() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "step-x".to_string(),
                model: "m".to_string(),
                prompt: json!("p"),
                output_schema: Some("S".to_string()),
                max_attempts: 3,
            },
            &storage,
        ).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        let result = handler.repair(
            LLMCallRepairInput { call_id: call_id.clone(), errors: "missing field".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            LLMCallRepairOutput::Ok { status, .. } => {
                assert_eq!(status, "requesting");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_reject_call() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "step-y".to_string(),
                model: "m".to_string(),
                prompt: json!("p"),
                output_schema: None,
                max_attempts: 1,
            },
            &storage,
        ).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        let result = handler.reject(
            LLMCallRejectInput { call_id: call_id.clone(), reason: "poor quality".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            LLMCallRejectOutput::Ok { reason, .. } => {
                assert_eq!(reason, "poor quality");
            }
            _ => panic!("Expected Ok variant"),
        }
    }
}
