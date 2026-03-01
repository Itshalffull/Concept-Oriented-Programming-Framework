// generated: snapshot/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SnapshotHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn snapshot_invariant_1() {
        // invariant 1: after compare, approve, compare behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let s2 = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // compare(outputPath: "generated/ts/password.ts", currentContent: "...") -> changed(snapshot: s, diff: "...", linesAdded: 5, linesRemoved: 3)
        let step1 = handler.compare(
            CompareInput { output_path: "generated/ts/password.ts".to_string(), current_content: "...".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            CompareOutput::Changed { snapshot, diff, lines_added, lines_removed, .. } => {
                assert_eq!(snapshot, s.clone());
                assert_eq!(diff, "...".to_string());
                assert_eq!(lines_added, 5);
                assert_eq!(lines_removed, 3);
            },
            other => panic!("Expected Changed, got {:?}", other),
        }
        // approve(path: "generated/ts/password.ts") -> ok(snapshot: s2)
        let step2 = handler.approve(
            ApproveInput { path: "generated/ts/password.ts".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ApproveOutput::Ok { snapshot, .. } => {
                assert_eq!(snapshot, s2.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // compare(outputPath: "generated/ts/password.ts", currentContent: "...") -> unchanged(snapshot: s2)
        let step3 = handler.compare(
            CompareInput { output_path: "generated/ts/password.ts".to_string(), current_content: "...".to_string() },
            &storage,
        ).await.unwrap();
        match step3 {
            CompareOutput::Unchanged { snapshot, .. } => {
                assert_eq!(snapshot, s2.clone());
            },
            other => panic!("Expected Unchanged, got {:?}", other),
        }
    }

}
