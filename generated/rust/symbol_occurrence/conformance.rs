// generated: symbol_occurrence/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SymbolOccurrenceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn symbol_occurrence_invariant_1() {
        // invariant 1: after record, findDefinitions behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let o = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // record(symbol: "clef/concept/Article", file: "specs/article.concept", startRow: 2, startCol: 8, endRow: 2, endCol: 15, startByte: 30, endByte: 37, role: "definition") -> ok(occurrence: o)
        let step1 = handler.record(
            RecordInput { symbol: "clef/concept/Article".to_string(), file: "specs/article.concept".to_string(), start_row: 2, start_col: 8, end_row: 2, end_col: 15, start_byte: 30, end_byte: 37, role: "definition".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { occurrence, .. } => {
                assert_eq!(occurrence, o.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // findDefinitions(symbol: "clef/concept/Article") -> ok(occurrences: _)
        let step2 = handler.find_definitions(
            FindDefinitionsInput { symbol: "clef/concept/Article".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            FindDefinitionsOutput::Ok { occurrences, .. } => {
                assert_eq!(occurrences, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn symbol_occurrence_invariant_2() {
        // invariant 2: after record, findAtPosition behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let o = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // record(symbol: "clef/concept/Article", file: "specs/article.concept", startRow: 2, startCol: 8, endRow: 2, endCol: 15, startByte: 30, endByte: 37, role: "definition") -> ok(occurrence: o)
        let step1 = handler.record(
            RecordInput { symbol: "clef/concept/Article".to_string(), file: "specs/article.concept".to_string(), start_row: 2, start_col: 8, end_row: 2, end_col: 15, start_byte: 30, end_byte: 37, role: "definition".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RecordOutput::Ok { occurrence, .. } => {
                assert_eq!(occurrence, o.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // findAtPosition(file: "specs/article.concept", row: 2, col: 10) -> ok(occurrence: o, symbol: "clef/concept/Article")
        let step2 = handler.find_at_position(
            FindAtPositionInput { file: "specs/article.concept".to_string(), row: 2, col: 10 },
            &storage,
        ).await.unwrap();
        match step2 {
            FindAtPositionOutput::Ok { occurrence, symbol, .. } => {
                assert_eq!(occurrence, o.clone());
                assert_eq!(symbol, "clef/concept/Article".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
