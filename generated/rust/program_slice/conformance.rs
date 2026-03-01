// generated: program_slice/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ProgramSliceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn program_slice_invariant_1() {
        // invariant 1: after compute, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let z = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // compute(criterion: "clef/state-field/Article/title", direction: "forward") -> ok(slice: z)
        let step1 = handler.compute(
            ComputeInput { criterion: "clef/state-field/Article/title".to_string(), direction: "forward".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            ComputeOutput::Ok { slice, .. } => {
                assert_eq!(slice, z.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(slice: z) -> ok(slice: z, criterionSymbol: "clef/state-field/Article/title", direction: "forward", symbolCount: _, fileCount: _, edgeCount: _)
        let step2 = handler.get(
            GetInput { slice: z.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { slice, criterion_symbol, direction, symbol_count, file_count, edge_count, .. } => {
                assert_eq!(slice, z.clone());
                assert_eq!(criterion_symbol, "clef/state-field/Article/title".to_string());
                assert_eq!(direction, "forward".to_string());
                assert_eq!(symbol_count, .clone());
                assert_eq!(file_count, .clone());
                assert_eq!(edge_count, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
