// generated: claude_skills_target/conformance.rs

#[cfg(test)]
mod tests {
    use super::super::handler::ClaudeSkillsTargetHandler;
    use super::super::types::*;
    use crate::storage::create_in_memory_storage;

    #[tokio::test]
    async fn claude_skills_target_invariant_1() {
        // invariant 1: after generate, listSkills behaves correctly
        let storage = create_in_memory_storage();
        let handler = create_test_handler(); // provided by implementor

        let s = "u-test-invariant-001".to_string();
        let f = "u-test-invariant-002".to_string();
        let all = "u-test-invariant-003".to_string();
        let e = "u-test-invariant-004".to_string();
        let fl = "u-test-invariant-005".to_string();

        // --- AFTER clause ---
        // generate(projection: "spec-parser-projection", config: "{\"progressive\":true}") -> ok(skills: s, files: f)
        let step1 = handler.generate(
            GenerateInput { projection: "spec-parser-projection".to_string(), config: "{"progressive":true}".to_string() },
            &storage,
        ).await.unwrap();
        match step1 {
            GenerateOutput::Ok { skills, files, .. } => {
                assert_eq!(skills, s.clone());
                assert_eq!(files, f.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }

        // --- THEN clause ---
        // listSkills(kit: "test-kit") -> ok(skills: all, enriched: e, flat: fl)
        let step2 = handler.list_skills(
            ListSkillsInput { kit: "test-kit".to_string() },
            &storage,
        ).await.unwrap();
        match step2 {
            ListSkillsOutput::Ok { skills, enriched, flat, .. } => {
                assert_eq!(skills, all.clone());
                assert_eq!(enriched, e.clone());
                assert_eq!(flat, fl.clone());
            },
            other => panic!("Expected Ok, got {:?}", other),
        }
    }

}
