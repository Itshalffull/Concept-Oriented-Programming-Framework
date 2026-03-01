// generated: language_grammar/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::LanguageGrammarHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn language_grammar_invariant_1() {
        // invariant 1: after register, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "typescript", extensions: "[\".ts\",\".tsx\"]", parserWasmPath: "tree-sitter-typescript.wasm", nodeTypes: "{}") -> ok(grammar: g)
        let step1 = handler.register(
            RegisterInput { name: "typescript".to_string(), extensions: "[".ts",".tsx"]".to_string(), parser_wasm_path: "tree-sitter-typescript.wasm".to_string(), node_types: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { grammar, .. } => {
                assert_eq!(grammar, g.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(fileExtension: ".ts") -> ok(grammar: g)
        let step2 = handler.resolve(
            ResolveInput { file_extension: ".ts".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { grammar, .. } => {
                assert_eq!(grammar, g.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn language_grammar_invariant_2() {
        // invariant 2: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let g = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(name: "typescript", extensions: "[\".ts\"]", parserWasmPath: "ts.wasm", nodeTypes: "{}") -> ok(grammar: g)
        let step1 = handler.register(
            RegisterInput { name: "typescript".to_string(), extensions: "[".ts"]".to_string(), parser_wasm_path: "ts.wasm".to_string(), node_types: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { grammar, .. } => {
                assert_eq!(grammar, g.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(name: "typescript", extensions: "[\".ts\"]", parserWasmPath: "ts.wasm", nodeTypes: "{}") -> alreadyRegistered(existing: g)
        let step2 = handler.register(
            RegisterInput { name: "typescript".to_string(), extensions: "[".ts"]".to_string(), parser_wasm_path: "ts.wasm".to_string(), node_types: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::AlreadyRegistered { existing, .. } => {
                assert_eq!(existing, g.clone());
            },
            other => panic!("Expected AlreadyRegistered, got {:?}", other),
        }
    }

}
