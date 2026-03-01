// generated: definition_unit/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::DefinitionUnitHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn definition_unit_invariant_1() {
        // invariant 1: after extract, findBySymbol behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let u = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // extract(tree: "t1", startByte: 0, endByte: 100) -> ok(unit: u)
        let step1 = handler.extract(
            ExtractInput { tree: "t1".to_string(), start_byte: 0, end_byte: 100 },
            &storage,
        ).await.unwrap();
        match step1 {
            ExtractOutput::Ok { unit, .. } => {
                assert_eq!(unit, u.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // findBySymbol(symbol: "sym-u") -> notfound()
        let step2 = handler.find_by_symbol(
            FindBySymbolInput { symbol: "sym-u".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, FindBySymbolOutput::Notfound));
    }

}
