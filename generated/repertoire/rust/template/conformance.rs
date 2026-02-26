// generated: template/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TemplateHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn template_invariant_1() {
        // invariant 1: after define, instantiate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let t = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // define(template: t, body: "Hello {{name}}", variables: "name") -> ok()
        let step1 = handler.define(
            DefineInput { template: t.clone(), body: "Hello {{name}}".to_string(), variables: "name".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, DefineOutput::Ok));

        // --- THEN clause ---
        // instantiate(template: t, values: "name=World") -> ok(content: "Hello World")
        let step2 = handler.instantiate(
            InstantiateInput { template: t.clone(), values: "name=World".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            InstantiateOutput::Ok { content, .. } => {
                assert_eq!(content, "Hello World".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
