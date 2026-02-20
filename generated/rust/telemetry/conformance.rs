// generated: telemetry/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::TelemetryHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn telemetry_invariant_1() {
        // invariant 1: after configure, configure behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        // --- AFTER clause ---
        // configure(exporter: "stdout") -> ok()
        let step1 = handler.configure(
            ConfigureInput { exporter: "stdout".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step1, ConfigureOutput::Ok));

        // --- THEN clause ---
        // configure(exporter: "stdout") -> ok()
        let step2 = handler.configure(
            ConfigureInput { exporter: "stdout".to_string() },
            &storage,
        ).await.unwrap();
        assert!(matches!(step2, ConfigureOutput::Ok));
    }

}
