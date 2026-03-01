// generated: schema/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::SchemaHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn schema_invariant_1() {
        // invariant 1: after defineSchema, addField, applyTo behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();

        // --- AFTER clause ---
        // defineSchema(schema: s, fields: "title,body") -> ok()
        let step1 = handler.define_schema(
            DefineSchemaInput { schema: s.clone(), fields: "title,body".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, DefineSchemaOutput::Ok));

        // --- THEN clause ---
        // addField(schema: s, field: "author") -> ok()
        let step2 = handler.add_field(
            AddFieldInput { schema: s.clone(), field: "author".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, AddFieldOutput::Ok));
        // applyTo(entity: "page-1", schema: s) -> ok()
        let step3 = handler.apply_to(
            ApplyToInput { entity: "page-1".to_string(), schema: s.clone() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step3, ApplyToOutput::Ok));
    }

}
