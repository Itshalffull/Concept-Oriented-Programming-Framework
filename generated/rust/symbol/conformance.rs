// generated: symbol/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SymbolHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn symbol_invariant_1() {
        // invariant 1: after register, get behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(symbolString: "clef/concept/Article", kind: "concept", displayName: "Article", definingFile: "specs/article.concept") -> ok(symbol: s)
        let step1 = handler.register(
            RegisterInput { symbol_string: "clef/concept/Article".to_string(), kind: "concept".to_string(), display_name: "Article".to_string(), defining_file: "specs/article.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { symbol, .. } => {
                assert_eq!(symbol, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // get(symbol: s) -> ok(symbol: s, symbolString: "clef/concept/Article", kind: "concept", displayName: "Article", visibility: "public", definingFile: "specs/article.concept", namespace: "clef/concept")
        let step2 = handler.get(
            GetInput { symbol: s.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetOutput::Ok { symbol, symbol_string, kind, display_name, visibility, defining_file, namespace, .. } => {
                assert_eq!(symbol, s.clone());
                assert_eq!(symbol_string, "clef/concept/Article".to_string());
                assert_eq!(kind, "concept".to_string());
                assert_eq!(display_name, "Article".to_string());
                assert_eq!(visibility, "public".to_string());
                assert_eq!(defining_file, "specs/article.concept".to_string());
                assert_eq!(namespace, "clef/concept".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn symbol_invariant_2() {
        // invariant 2: after register, resolve behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(symbolString: "clef/concept/Article", kind: "concept", displayName: "Article", definingFile: "specs/article.concept") -> ok(symbol: s)
        let step1 = handler.register(
            RegisterInput { symbol_string: "clef/concept/Article".to_string(), kind: "concept".to_string(), display_name: "Article".to_string(), defining_file: "specs/article.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { symbol, .. } => {
                assert_eq!(symbol, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // resolve(symbolString: "clef/concept/Article") -> ok(symbol: s)
        let step2 = handler.resolve(
            ResolveInput { symbol_string: "clef/concept/Article".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ResolveOutput::Ok { symbol, .. } => {
                assert_eq!(symbol, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn symbol_invariant_3() {
        // invariant 3: after register, register behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // register(symbolString: "clef/concept/Article", kind: "concept", displayName: "Article", definingFile: "specs/article.concept") -> ok(symbol: s)
        let step1 = handler.register(
            RegisterInput { symbol_string: "clef/concept/Article".to_string(), kind: "concept".to_string(), display_name: "Article".to_string(), defining_file: "specs/article.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterOutput::Ok { symbol, .. } => {
                assert_eq!(symbol, s.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // register(symbolString: "clef/concept/Article", kind: "concept", displayName: "Article", definingFile: "specs/article.concept") -> alreadyExists(existing: s)
        let step2 = handler.register(
            RegisterInput { symbol_string: "clef/concept/Article".to_string(), kind: "concept".to_string(), display_name: "Article".to_string(), defining_file: "specs/article.concept".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterOutput::AlreadyExists { existing, .. } => {
                assert_eq!(existing, s.clone());
            },
            other => panic!("Expected AlreadyExists, got {:?}", other),
        }
    }

}
