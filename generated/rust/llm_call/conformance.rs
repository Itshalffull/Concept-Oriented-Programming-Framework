// generated: llm_call/conformance.rs
// Conformance tests for LLMCall concept invariants.

#[cfg(test)]
mod tests {
    use super::super::handler::LLMCallHandler;
    use super::super::r#impl::LLMCallHandlerImpl;
    use super::super::types::*;
    use crate::storage::InMemoryStorage;
    use serde_json::json;

    fn create_test_handler() -> LLMCallHandlerImpl {
        LLMCallHandlerImpl
    }

    #[tokio::test]
    async fn llm_call_invariant_request_response_validate_accept() {
        // Invariant: request -> record_response -> validate(valid) transitions to accepted
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "draft".to_string(),
                model: "claude-sonnet".to_string(),
                prompt: json!({ "text": "Write email" }),
                output_schema: Some("Email:v1".to_string()),
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
                raw_output: json!({ "subject": "Hello", "body": "Dear user..." }),
                input_tokens: 100,
                output_tokens: 200,
            },
            &storage,
        ).await.unwrap();

        let validate = handler.validate(
            LLMCallValidateInput { call_id: call_id.clone() },
            &storage,
        ).await.unwrap();
        match validate {
            LLMCallValidateOutput::Valid { step_ref, validated_output, .. } => {
                assert_eq!(step_ref, "draft");
                assert_eq!(validated_output["subject"], "Hello");
            }
            _ => panic!("Expected Valid"),
        }
    }

    #[tokio::test]
    async fn llm_call_invariant_repair_loop_exhaustion() {
        // Invariant: repair past max_attempts transitions to rejected
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "gen".to_string(),
                model: "m".to_string(),
                prompt: json!("p"),
                output_schema: Some("S".to_string()),
                max_attempts: 2,
            },
            &storage,
        ).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        // First repair: attempt_count becomes 1 (< max_attempts=2), OK
        handler.repair(
            LLMCallRepairInput { call_id: call_id.clone(), errors: "err1".to_string() },
            &storage,
        ).await.unwrap();

        // Second repair: attempt_count becomes 2 (>= max_attempts=2), MaxAttemptsReached
        let result = handler.repair(
            LLMCallRepairInput { call_id: call_id.clone(), errors: "err2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            LLMCallRepairOutput::MaxAttemptsReached { step_ref, .. } => {
                assert_eq!(step_ref, "gen");
            }
            _ => panic!("Expected MaxAttemptsReached"),
        }
    }

    #[tokio::test]
    async fn llm_call_invariant_no_schema_auto_accepts() {
        // Invariant: without output_schema, record_response auto-accepts
        let storage = InMemoryStorage::new();
        let handler = create_test_handler();

        let req = handler.request(
            LLMCallRequestInput {
                step_ref: "free".to_string(),
                model: "m".to_string(),
                prompt: json!("hello"),
                output_schema: None,
                max_attempts: 1,
            },
            &storage,
        ).await.unwrap();
        let call_id = match req {
            LLMCallRequestOutput::Ok { call_id, .. } => call_id,
        };

        let resp = handler.record_response(
            LLMCallRecordResponseInput {
                call_id: call_id.clone(),
                raw_output: json!("free text"),
                input_tokens: 10,
                output_tokens: 5,
            },
            &storage,
        ).await.unwrap();
        match resp {
            LLMCallRecordResponseOutput::Ok { status, .. } => {
                assert_eq!(status, "accepted");
            }
            _ => panic!("Expected Ok with accepted status"),
        }
    }
}
