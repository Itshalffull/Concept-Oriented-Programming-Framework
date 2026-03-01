// generated: cli_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::CliTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn cli_target_invariant_1() {
        // invariant 1: after generate, listCommands behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let c = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let cmds = "u-test-invariant-003".to_string();
        let subs = "u-test-invariant-004".to_string();

        // --- AFTER clause ---
        // generate(projection: "task-projection", config: "{}") -> ok(commands: c, files: f)
        let step1 = handler.generate(
            GenerateInput { projection: "task-projection".to_string(), config: "{}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { commands, files, .. } => {
                assert_eq!(commands, c.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listCommands(concept: "Task") -> ok(commands: cmds, subcommands: subs)
        let step2 = handler.list_commands(
            ListCommandsInput { concept: "Task".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListCommandsOutput::Ok { commands, subcommands, .. } => {
                assert_eq!(commands, cmds.clone());
                assert_eq!(subcommands, subs.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
