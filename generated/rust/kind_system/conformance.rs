// generated: kind_system/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::KindSystemHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn kind_system_invariant_1() {
        // invariant 1: after define, define, connect, validate, route, dependents behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let ast = "u-test-invariant-001".to_string();
        let mfst = "u-test-invariant-002".to_string();
        let p = "u-test-invariant-003".to_string();
        let d = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // define(name: "ConceptAST", category: "model") -> ok(kind: ast)
        let step1 = handler.define(
            DefineInput { name: "ConceptAST".to_string(), category: "model".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            DefineOutput::Ok { kind, .. } => {
                assert_eq!(kind, ast.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // define(name: "ConceptManifest", category: "model") -> ok(kind: mfst)
        let step2 = handler.define(
            DefineInput { name: "ConceptManifest".to_string(), category: "model".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            DefineOutput::Ok { kind, .. } => {
                assert_eq!(kind, mfst.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // connect(from: ast, to: mfst, relation: "normalizes_to", transformName: "SchemaGen") -> ok()
        let step3 = handler.connect(
            ConnectInput { from: ast.clone(), to: mfst.clone(), relation: "normalizes_to".to_string(), transform_name: "SchemaGen".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, ConnectOutput::Ok));

        // --- THEN clause ---
        // validate(from: ast, to: mfst) -> ok()
        let step4 = handler.validate(
            ValidateInput { from: ast.clone(), to: mfst.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step4, ValidateOutput::Ok));
        // route(from: ast, to: mfst) -> ok(path: p)
        let step5 = handler.route(
            RouteInput { from: ast.clone(), to: mfst.clone() },
            &storage,
        ).await.unwrap();
        match step5 {
            RouteOutput::Ok { path, .. } => {
                assert_eq!(path, p.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
        // dependents(kind: ast) -> ok(downstream: d)
        let step6 = handler.dependents(
            DependentsInput { kind: ast.clone() },
            &storage,
        ).await.unwrap();
        match step6 {
            DependentsOutput::Ok { downstream, .. } => {
                assert_eq!(downstream, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
