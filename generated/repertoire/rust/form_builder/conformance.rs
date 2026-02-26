// generated: form_builder/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::FormBuilderHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn form_builder_invariant_1() {
        // invariant 1: after buildForm, registerWidget behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // buildForm(form: f, schema: "user-profile") -> ok(definition: _)
        let step1 = handler.build_form(
            BuildFormInput { form: f.clone(), schema: "user-profile".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            BuildFormOutput::Ok { definition, .. } => {
                assert_eq!(definition, .clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // registerWidget(form: f, type: "date", widget: "datepicker") -> ok(form: f)
        let step2 = handler.register_widget(
            RegisterWidgetInput { form: f.clone(), type: "date".to_string(), widget: "datepicker".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            RegisterWidgetOutput::Ok { form, .. } => {
                assert_eq!(form, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn form_builder_invariant_2() {
        // invariant 2: after registerWidget, validate behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let f = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // registerWidget(form: f, type: "date", widget: "datepicker") -> ok(form: f)
        let step1 = handler.register_widget(
            RegisterWidgetInput { form: f.clone(), type: "date".to_string(), widget: "datepicker".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            RegisterWidgetOutput::Ok { form, .. } => {
                assert_eq!(form, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // validate(form: f, data: "name=Alice&dob=2000-01-01") -> ok(valid: true, errors: "")
        let step2 = handler.validate(
            ValidateInput { form: f.clone(), data: "name=Alice&dob=2000-01-01".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ValidateOutput::Ok { valid, errors, .. } => {
                assert_eq!(valid, true);
                assert_eq!(errors, "".to_string());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
