// generated: quality_signal/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::QualitySignalHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn quality_signal_invariant_1() {
        // invariant 1: after record, latest behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let null = "u-test-invariant-001".to_string();
        let q = "u-test-invariant-002".to_string();
        let t = "u-test-invariant-003".to_string();

        // --- AFTER clause ---
        // record(target_symbol: "clef/concept/Password", dimension: "formal", status: "pass", severity: "gate", summary: "Proved 3 properties", artifact_path: null, artifact_hash: null, run_ref: "run-1") -> ok(signal: q)
        let step1 = handler.record(
            RecordInput { target_symbol: "clef/concept/Password".to_string(), dimension: "formal".to_string(), status: "pass".to_string(), severity: "gate".to_string(), summary: "Proved 3 properties".to_string(), artifact_path: null.clone(), artifact_hash: null.clone(), run_ref: "run-1".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { signal, .. } => {
                assert_eq!(signal, q.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // latest(target_symbol: "clef/concept/Password", dimension: "formal") -> ok(signal: q, status: "pass", severity: "gate", summary: "Proved 3 properties", observed_at: t)
        let step2 = handler.latest(
            LatestInput { target_symbol: "clef/concept/Password".to_string(), dimension: "formal".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            LatestOutput::Ok { signal, status, severity, summary, observed_at, .. } => {
                assert_eq!(signal, q.clone());
                assert_eq!(status, "pass".to_string());
                assert_eq!(severity, "gate".to_string());
                assert_eq!(summary, "Proved 3 properties".to_string());
                assert_eq!(observed_at, t.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}