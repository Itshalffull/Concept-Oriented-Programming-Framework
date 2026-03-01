// generated: generation_plan/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::GenerationPlanHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn generation_plan_invariant_1() {
        // invariant 1: after begin, recordStep, status, summary behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let r = "u-test-invariant-001".to_string();
        let s = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // begin() -> ok(run: r)
        let step1 = handler.begin(
            BeginInput {  },
            &storage,
        ).await.unwrap();
        match step1 {
            BeginOutput::Ok { run, .. } => {
                assert_eq!(run, r.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // recordStep(stepKey: "step1", status: "done", filesProduced: 3, duration: 100, cached: false) -> ok()
        let step2 = handler.record_step(
            RecordStepInput { step_key: "step1".to_string(), status: "done".to_string(), files_produced: 3, duration: 100, cached: false },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, RecordStepOutput::Ok));

        // --- THEN clause ---
        // status(run: r) -> ok(steps: s)
        let step3 = handler.status(
            StatusInput { run: r.clone() },
            &storage,
        ).await.unwrap();
        match step3 {
            StatusOutput::Ok { steps, .. } => {
                assert_eq!(steps, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // summary(run: r) -> ok(total: 1, executed: 1, cached: 0, failed: 0, totalDuration: 100, filesProduced: 3)
        let step4 = handler.summary(
            SummaryInput { run: r.clone() },
            &storage,
        ).await.unwrap();
        match step4 {
            SummaryOutput::Ok { total, executed, cached, failed, total_duration, files_produced, .. } => {
                assert_eq!(total, 1);
                assert_eq!(executed, 1);
                assert_eq!(cached, 0);
                assert_eq!(failed, 0);
                assert_eq!(total_duration, 100);
                assert_eq!(files_produced, 3);
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
