// generated: namespace/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::NamespaceHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn namespace_invariant_1() {
        // invariant 1: after createNamespacedPage, getChildren behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let n = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // createNamespacedPage(node: n, path: "projects/alpha") -> ok()
        let step1 = handler.create_namespaced_page(
            CreateNamespacedPageInput { node: n.clone(), path: "projects/alpha".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, CreateNamespacedPageOutput::Ok));

        // --- THEN clause ---
        // getChildren(node: n) -> ok(children: "")
        let step2 = handler.get_children(
            GetChildrenInput { node: n.clone() },
            &storage,
        ).await.unwrap();
        match step2 {
            GetChildrenOutput::Ok { children, .. } => {
                assert_eq!(children, "".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
