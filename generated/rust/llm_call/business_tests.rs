// Business logic tests for LLMCall concept.
// Validates the request-response-validate-repair lifecycle,
// schema-driven vs. schema-free paths, and max attempts enforcement.

#[cfg(test)]
mod tests {
    use super::super::handler::LLMCallHandler;
    use super::super::r#impl::LLMCallHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    #[tokio::test]
    async fn test_full_lifecycle_with_schema_validation() {
        // request -> record_response (validating) -> validate (accepted)
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(LLMCallRequestInput {
            step_ref: "generate-summary".to_string(),
            model: "claude-sonnet".to_string(),
            prompt: json!({"text": "Summarize the Q4 report"}),
            output_schema: Some("SummarySchema:v1".to_string()),
            max_attempts: 3,
        }, &storage).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, status, .. } => {
                assert_eq!(status, "requesting");
                call_id
            }
        };

        let resp = handler.record_response(LLMCallRecordResponseInput {
            call_id: call_id.clone(),
            raw_output: json!({"summary": "Revenue grew 15% YoY", "confidence": 0.92}),
            input_tokens: 500,
            output_tokens: 150,
        }, &storage).await.unwrap();
        match resp {
            LLMCallRecordResponseOutput::Ok { status, .. } => assert_eq!(status, "validating"),
            _ => panic!("Expected Ok"),
        }

        let validate = handler.validate(LLMCallValidateInput {
            call_id: call_id.clone(),
        }, &storage).await.unwrap();
        match validate {
            LLMCallValidateOutput::Valid { validated_output, step_ref, .. } => {
                assert_eq!(step_ref, "generate-summary");
                assert_eq!(validated_output["summary"], "Revenue grew 15% YoY");
            }
            _ => panic!("Expected Valid"),
        }
    }

    #[tokio::test]
    async fn test_schema_free_response_auto_accepted() {
        // Without output_schema, record_response should go straight to accepted
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(LLMCallRequestInput {
            step_ref: "free-text".to_string(),
            model: "gpt-4".to_string(),
            prompt: json!("Write a poem"),
            output_schema: None,
            max_attempts: 1,
        }, &storage).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        let resp = handler.record_response(LLMCallRecordResponseInput {
            call_id: call_id.clone(),
            raw_output: json!("Roses are red, violets are blue"),
            input_tokens: 20,
            output_tokens: 10,
        }, &storage).await.unwrap();
        match resp {
            LLMCallRecordResponseOutput::Ok { status, .. } => assert_eq!(status, "accepted"),
            _ => panic!("Expected Ok with accepted status"),
        }
    }

    #[tokio::test]
    async fn test_repair_loop_reaches_max_attempts() {
        // request -> repair -> repair -> repair (max reached -> rejected)
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(LLMCallRequestInput {
            step_ref: "strict-gen".to_string(),
            model: "model-x".to_string(),
            prompt: json!("Generate structured data"),
            output_schema: Some("StrictSchema:v1".to_string()),
            max_attempts: 3,
        }, &storage).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        // Repair attempt 1 (attempt_count becomes 1)
        let r1 = handler.repair(LLMCallRepairInput {
            call_id: call_id.clone(),
            errors: "missing field 'name'".to_string(),
        }, &storage).await.unwrap();
        match r1 {
            LLMCallRepairOutput::Ok { status, .. } => assert_eq!(status, "requesting"),
            _ => panic!("Expected Ok"),
        }

        // Repair attempt 2 (attempt_count becomes 2)
        let r2 = handler.repair(LLMCallRepairInput {
            call_id: call_id.clone(),
            errors: "invalid type for 'age'".to_string(),
        }, &storage).await.unwrap();
        match r2 {
            LLMCallRepairOutput::Ok { status, .. } => assert_eq!(status, "requesting"),
            _ => panic!("Expected Ok"),
        }

        // Repair attempt 3 (attempt_count becomes 3 >= max_attempts 3 -> rejected)
        let r3 = handler.repair(LLMCallRepairInput {
            call_id: call_id.clone(),
            errors: "still invalid".to_string(),
        }, &storage).await.unwrap();
        match r3 {
            LLMCallRepairOutput::MaxAttemptsReached { step_ref, .. } => {
                assert_eq!(step_ref, "strict-gen");
            }
            _ => panic!("Expected MaxAttemptsReached"),
        }
    }

    #[tokio::test]
    async fn test_reject_explicitly() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(LLMCallRequestInput {
            step_ref: "draft".to_string(),
            model: "m".to_string(),
            prompt: json!("Write email"),
            output_schema: None,
            max_attempts: 1,
        }, &storage).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        let result = handler.reject(LLMCallRejectInput {
            call_id: call_id.clone(),
            reason: "Output contains harmful content".to_string(),
        }, &storage).await.unwrap();
        match result {
            LLMCallRejectOutput::Ok { reason, step_ref, .. } => {
                assert_eq!(reason, "Output contains harmful content");
                assert_eq!(step_ref, "draft");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_accept_manually_bypasses_validation() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(LLMCallRequestInput {
            step_ref: "manual-accept".to_string(),
            model: "m".to_string(),
            prompt: json!("Generate"),
            output_schema: Some("Schema".to_string()),
            max_attempts: 1,
        }, &storage).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        handler.record_response(LLMCallRecordResponseInput {
            call_id: call_id.clone(),
            raw_output: json!({"data": "some output"}),
            input_tokens: 10,
            output_tokens: 5,
        }, &storage).await.unwrap();

        let result = handler.accept(LLMCallAcceptInput {
            call_id: call_id.clone(),
        }, &storage).await.unwrap();
        match result {
            LLMCallAcceptOutput::Ok { step_ref, output, .. } => {
                assert_eq!(step_ref, "manual-accept");
                assert_eq!(output["data"], "some output");
            }
            _ => panic!("Expected Ok"),
        }
    }

    #[tokio::test]
    async fn test_record_response_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let result = handler.record_response(LLMCallRecordResponseInput {
            call_id: "llm-missing".to_string(),
            raw_output: json!("data"),
            input_tokens: 1,
            output_tokens: 1,
        }, &storage).await.unwrap();
        match result {
            LLMCallRecordResponseOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let result = handler.validate(LLMCallValidateInput {
            call_id: "llm-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            LLMCallValidateOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_repair_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let result = handler.repair(LLMCallRepairInput {
            call_id: "llm-ghost".to_string(),
            errors: "err".to_string(),
        }, &storage).await.unwrap();
        match result {
            LLMCallRepairOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_accept_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let result = handler.accept(LLMCallAcceptInput {
            call_id: "llm-ghost".to_string(),
        }, &storage).await.unwrap();
        match result {
            LLMCallAcceptOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_reject_not_found() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let result = handler.reject(LLMCallRejectInput {
            call_id: "llm-ghost".to_string(),
            reason: "n/a".to_string(),
        }, &storage).await.unwrap();
        match result {
            LLMCallRejectOutput::NotFound { .. } => {}
            _ => panic!("Expected NotFound"),
        }
    }

    #[tokio::test]
    async fn test_empty_schema_string_treated_as_no_schema() {
        let storage = InMemoryStorage::new();
        let handler = LLMCallHandlerImpl;

        let req = handler.request(LLMCallRequestInput {
            step_ref: "empty-schema".to_string(),
            model: "m".to_string(),
            prompt: json!("prompt"),
            output_schema: Some("".to_string()),
            max_attempts: 1,
        }, &storage).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        // Empty schema string should behave like no schema -- go to accepted
        let resp = handler.record_response(LLMCallRecordResponseInput {
            call_id: call_id.clone(),
            raw_output: json!("output"),
            input_tokens: 5,
            output_tokens: 5,
        }, &storage).await.unwrap();
        match resp {
            LLMCallRecordResponseOutput::Ok { status, .. } => {
                assert_eq!(status, "accepted");
            }
            _ => panic!("Expected Ok"),
        }
    }
}
