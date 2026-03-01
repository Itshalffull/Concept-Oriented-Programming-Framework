// generated: form_builder/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FormBuilderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn form_builder_invariant_1() {
        // invariant 1: after buildForm, buildForm behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();
        let d = "u-test-invariant-002".to_string();

        // --- AFTER clause ---
        // buildForm(form: f, schema: "user-profile") -> ok(definition: d)
        let step1 = handler.build_form(
            BuildFormInput { form: f.clone(), schema: "user-profile".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            BuildFormOutput::Ok { definition, .. } => {
                assert_eq!(definition, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // buildForm(form: f, schema: "user-profile") -> ok(definition: d)
        let step2 = handler.build_form(
            BuildFormInput { form: f.clone(), schema: "user-profile".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            BuildFormOutput::Ok { definition, .. } => {
                assert_eq!(definition, d.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
