// Claude Skills Target -- generate Claude skill definitions from concept projections
// Produces skill YAML files with frontmatter, references, and validation.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ClaudeSkillsTargetHandler;
use serde_json::json;

pub struct ClaudeSkillsTargetHandlerImpl;

#[async_trait]
impl ClaudeSkillsTargetHandler for ClaudeSkillsTargetHandlerImpl {
    async fn generate(
        &self,
        input: ClaudeSkillsTargetGenerateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ClaudeSkillsTargetGenerateOutput, Box<dyn std::error::Error>> {
        let projection = &input.projection;
        let config: serde_json::Value = serde_json::from_str(&input.config).unwrap_or(json!({}));

        if projection.is_empty() {
            return Ok(ClaudeSkillsTargetGenerateOutput::MissingProjection {
                concept: "unknown".to_string(),
            });
        }

        // Extract concept name from projection ID
        let concept_name = projection
            .replace("-projection", "")
            .replace('-', " ");
        let skill_slug = concept_name.to_lowercase().replace(' ', "-");

        // Generate skill YAML frontmatter
        let description = config["description"]
            .as_str()
            .unwrap_or("Auto-generated skill");
        let skill_content = format!(
            "---\nname: {}\ndescription: {}\nconcept: {}\n---\n\n# {}\n\n{}\n",
            skill_slug, description, concept_name, concept_name, description
        );

        let skill_path = format!("skills/{}.md", skill_slug);

        storage.put("skill", &skill_slug, json!({
            "name": skill_slug,
            "concept": concept_name,
            "path": skill_path,
            "content": skill_content,
        })).await?;

        Ok(ClaudeSkillsTargetGenerateOutput::Ok {
            skills: vec![skill_slug],
            files: vec![skill_path],
        })
    }

    async fn validate(
        &self,
        input: ClaudeSkillsTargetValidateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ClaudeSkillsTargetValidateOutput, Box<dyn std::error::Error>> {
        let skill_record = storage.get("skill", &input.skill).await?;

        let record = match skill_record {
            Some(r) => r,
            None => {
                return Ok(ClaudeSkillsTargetValidateOutput::InvalidFrontmatter {
                    skill: input.skill.clone(),
                    errors: vec!["Skill not found".to_string()],
                });
            }
        };

        let mut errors = Vec::new();

        // Validate required frontmatter fields
        if record.get("name").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
            errors.push("Missing 'name' field in frontmatter".to_string());
        }
        if record.get("concept").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
            errors.push("Missing 'concept' field in frontmatter".to_string());
        }

        if !errors.is_empty() {
            return Ok(ClaudeSkillsTargetValidateOutput::InvalidFrontmatter {
                skill: input.skill,
                errors,
            });
        }

        // Check for broken concept references
        let concept_name = record["concept"].as_str().unwrap_or("");
        let concept_entity = storage.get("concept_entity", concept_name).await?;
        if concept_entity.is_none() {
            return Ok(ClaudeSkillsTargetValidateOutput::BrokenReferences {
                skill: input.skill,
                missing: vec![concept_name.to_string()],
            });
        }

        Ok(ClaudeSkillsTargetValidateOutput::Ok {
            skill: input.skill,
        })
    }

    async fn list_skills(
        &self,
        input: ClaudeSkillsTargetListSkillsInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ClaudeSkillsTargetListSkillsOutput, Box<dyn std::error::Error>> {
        let all_skills = storage.find("skill", Some(&json!({ "kit": input.kit }))).await?;

        let skills: Vec<String> = all_skills
            .iter()
            .filter_map(|s| s["name"].as_str().map(|n| n.to_string()))
            .collect();

        let enriched: Vec<String> = all_skills
            .iter()
            .filter_map(|s| {
                if s.get("concept").is_some() {
                    s["name"].as_str().map(|n| n.to_string())
                } else {
                    None
                }
            })
            .collect();

        let flat: Vec<String> = skills.clone();

        Ok(ClaudeSkillsTargetListSkillsOutput::Ok {
            skills,
            enriched,
            flat,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_generate_success() {
        let storage = InMemoryStorage::new();
        let handler = ClaudeSkillsTargetHandlerImpl;
        let result = handler.generate(
            ClaudeSkillsTargetGenerateInput {
                projection: "comment-projection".to_string(),
                config: r#"{"description":"Manage comments"}"#.to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ClaudeSkillsTargetGenerateOutput::Ok { skills, files } => {
                assert!(!skills.is_empty());
                assert!(!files.is_empty());
            },
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_generate_missing_projection() {
        let storage = InMemoryStorage::new();
        let handler = ClaudeSkillsTargetHandlerImpl;
        let result = handler.generate(
            ClaudeSkillsTargetGenerateInput {
                projection: "".to_string(),
                config: "{}".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ClaudeSkillsTargetGenerateOutput::MissingProjection { .. } => {},
            _ => panic!("Expected MissingProjection variant"),
        }
    }

    #[tokio::test]
    async fn test_validate_not_found() {
        let storage = InMemoryStorage::new();
        let handler = ClaudeSkillsTargetHandlerImpl;
        let result = handler.validate(
            ClaudeSkillsTargetValidateInput {
                skill: "nonexistent".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ClaudeSkillsTargetValidateOutput::InvalidFrontmatter { errors, .. } => {
                assert!(errors.iter().any(|e| e.contains("not found")));
            },
            _ => panic!("Expected InvalidFrontmatter variant"),
        }
    }

    #[tokio::test]
    async fn test_list_skills() {
        let storage = InMemoryStorage::new();
        let handler = ClaudeSkillsTargetHandlerImpl;
        let result = handler.list_skills(
            ClaudeSkillsTargetListSkillsInput {
                kit: "test-kit".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ClaudeSkillsTargetListSkillsOutput::Ok { skills, .. } => {
                // Empty list is valid when no skills exist
                assert!(skills.is_empty());
            },
        }
    }
}
