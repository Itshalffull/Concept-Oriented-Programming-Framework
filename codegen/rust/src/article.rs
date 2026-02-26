// Article Concept Implementation (Rust)
//
// Mirrors the TypeScript article.impl.ts — create, update, delete, get actions.
// Generates URL-safe slugs from article titles.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleCreateInput {
    pub article: String,
    pub title: String,
    pub description: String,
    pub body: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleCreateOutput {
    #[serde(rename = "ok")]
    Ok { article: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleUpdateInput {
    pub article: String,
    pub title: String,
    pub description: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleUpdateOutput {
    #[serde(rename = "ok")]
    Ok { article: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleDeleteInput {
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleDeleteOutput {
    #[serde(rename = "ok")]
    Ok { article: String },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ArticleGetInput {
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum ArticleGetOutput {
    #[serde(rename = "ok")]
    Ok {
        article: String,
        slug: String,
        title: String,
        description: String,
        body: String,
        author: String,
    },
    #[serde(rename = "notfound")]
    Notfound { message: String },
}

// ── Helpers ────────────────────────────────────────────────

fn slugify(title: &str) -> String {
    let raw: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();

    // Collapse consecutive hyphens and trim leading/trailing hyphens
    let mut slug = String::new();
    let mut prev_was_hyphen = false;
    for c in raw.chars() {
        if c == '-' {
            if !prev_was_hyphen && !slug.is_empty() {
                slug.push('-');
            }
            prev_was_hyphen = true;
        } else {
            slug.push(c);
            prev_was_hyphen = false;
        }
    }
    slug.trim_matches('-').to_string()
}

// ── Handler ────────────────────────────────────────────────

pub struct ArticleHandler;

impl ArticleHandler {
    pub async fn create(
        &self,
        input: ArticleCreateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ArticleCreateOutput> {
        let now = chrono::Utc::now().to_rfc3339();
        let slug = slugify(&input.title);

        storage
            .put(
                "article",
                &input.article,
                json!({
                    "article": input.article,
                    "slug": slug,
                    "title": input.title,
                    "description": input.description,
                    "body": input.body,
                    "author": input.author,
                    "createdAt": now,
                    "updatedAt": now,
                }),
            )
            .await?;

        Ok(ArticleCreateOutput::Ok {
            article: input.article,
        })
    }

    pub async fn update(
        &self,
        input: ArticleUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ArticleUpdateOutput> {
        let existing = storage.get("article", &input.article).await?;

        let Some(existing) = existing else {
            return Ok(ArticleUpdateOutput::Notfound {
                message: "Article not found".to_string(),
            });
        };

        let now = chrono::Utc::now().to_rfc3339();
        let slug = slugify(&input.title);

        // Merge with existing record, updating changed fields
        let mut updated = existing.clone();
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("slug".into(), json!(slug));
            obj.insert("title".into(), json!(input.title));
            obj.insert("description".into(), json!(input.description));
            obj.insert("body".into(), json!(input.body));
            obj.insert("updatedAt".into(), json!(now));
        }

        storage.put("article", &input.article, updated).await?;

        Ok(ArticleUpdateOutput::Ok {
            article: input.article,
        })
    }

    pub async fn delete(
        &self,
        input: ArticleDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ArticleDeleteOutput> {
        let existing = storage.get("article", &input.article).await?;

        if existing.is_none() {
            return Ok(ArticleDeleteOutput::Notfound {
                message: "Article not found".to_string(),
            });
        }

        storage.del("article", &input.article).await?;

        Ok(ArticleDeleteOutput::Ok {
            article: input.article,
        })
    }

    pub async fn get(
        &self,
        input: ArticleGetInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<ArticleGetOutput> {
        let record = storage.get("article", &input.article).await?;

        let Some(record) = record else {
            return Ok(ArticleGetOutput::Notfound {
                message: "Article not found".to_string(),
            });
        };

        Ok(ArticleGetOutput::Ok {
            article: input.article,
            slug: record["slug"].as_str().unwrap_or_default().to_string(),
            title: record["title"].as_str().unwrap_or_default().to_string(),
            description: record["description"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            body: record["body"].as_str().unwrap_or_default().to_string(),
            author: record["author"].as_str().unwrap_or_default().to_string(),
        })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("  My Article Title!  "), "my-article-title");
        assert_eq!(slugify("RUST & TypeScript"), "rust-typescript");
        assert_eq!(slugify("already-slugged"), "already-slugged");
        assert_eq!(slugify("multiple---hyphens"), "multiple-hyphens");
    }

    #[tokio::test]
    async fn create_and_get() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandler;

        let create_result = handler
            .create(
                ArticleCreateInput {
                    article: "a1".into(),
                    title: "Hello World".into(),
                    description: "A test article".into(),
                    body: "Lorem ipsum".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            create_result,
            ArticleCreateOutput::Ok { ref article } if article == "a1"
        ));

        let get_result = handler
            .get(ArticleGetInput { article: "a1".into() }, &storage)
            .await
            .unwrap();

        match get_result {
            ArticleGetOutput::Ok {
                article,
                slug,
                title,
                description,
                body,
                author,
            } => {
                assert_eq!(article, "a1");
                assert_eq!(slug, "hello-world");
                assert_eq!(title, "Hello World");
                assert_eq!(description, "A test article");
                assert_eq!(body, "Lorem ipsum");
                assert_eq!(author, "alice");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn update_article() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandler;

        handler
            .create(
                ArticleCreateInput {
                    article: "a1".into(),
                    title: "Old Title".into(),
                    description: "Old desc".into(),
                    body: "Old body".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let update_result = handler
            .update(
                ArticleUpdateInput {
                    article: "a1".into(),
                    title: "New Title".into(),
                    description: "New desc".into(),
                    body: "New body".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(update_result, ArticleUpdateOutput::Ok { .. }));

        let get_result = handler
            .get(ArticleGetInput { article: "a1".into() }, &storage)
            .await
            .unwrap();

        match get_result {
            ArticleGetOutput::Ok { title, slug, author, .. } => {
                assert_eq!(title, "New Title");
                assert_eq!(slug, "new-title");
                assert_eq!(author, "alice"); // author preserved
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn update_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandler;
        let result = handler
            .update(
                ArticleUpdateInput {
                    article: "nonexistent".into(),
                    title: "t".into(),
                    description: "d".into(),
                    body: "b".into(),
                },
                &storage,
            )
            .await
            .unwrap();
        assert!(matches!(result, ArticleUpdateOutput::Notfound { .. }));
    }

    #[tokio::test]
    async fn delete_article() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandler;

        handler
            .create(
                ArticleCreateInput {
                    article: "a1".into(),
                    title: "Title".into(),
                    description: "Desc".into(),
                    body: "Body".into(),
                    author: "alice".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let del_result = handler
            .delete(ArticleDeleteInput { article: "a1".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(del_result, ArticleDeleteOutput::Ok { .. }));

        let get_result = handler
            .get(ArticleGetInput { article: "a1".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(get_result, ArticleGetOutput::Notfound { .. }));
    }

    #[tokio::test]
    async fn delete_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandler;
        let result = handler
            .delete(ArticleDeleteInput { article: "nope".into() }, &storage)
            .await
            .unwrap();
        assert!(matches!(result, ArticleDeleteOutput::Notfound { .. }));
    }
}
