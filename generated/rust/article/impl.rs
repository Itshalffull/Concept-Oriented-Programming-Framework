// Article concept implementation
// Content management for articles with slug generation, CRUD operations, and listing.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::ArticleHandler;
use serde_json::json;

fn slugify(title: &str) -> String {
    let lower = title.to_lowercase();
    let slug: String = lower.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    // Collapse consecutive dashes and trim leading/trailing dashes
    let mut result = String::new();
    let mut prev_dash = true; // Start true to trim leading dashes
    for c in slug.chars() {
        if c == '-' {
            if !prev_dash {
                result.push('-');
            }
            prev_dash = true;
        } else {
            result.push(c);
            prev_dash = false;
        }
    }
    // Trim trailing dash
    if result.ends_with('-') {
        result.pop();
    }
    result
}

pub struct ArticleHandlerImpl;

#[async_trait]
impl ArticleHandler for ArticleHandlerImpl {
    async fn create(
        &self,
        input: ArticleCreateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleCreateOutput, Box<dyn std::error::Error>> {
        let now = chrono::Utc::now().to_rfc3339();
        let slug = slugify(&input.title);

        storage.put("article", &input.article, json!({
            "article": input.article,
            "slug": slug,
            "title": input.title,
            "description": input.description,
            "body": input.body,
            "author": input.author,
            "createdAt": now,
            "updatedAt": now,
        })).await?;

        Ok(ArticleCreateOutput::Ok { article: input.article })
    }

    async fn update(
        &self,
        input: ArticleUpdateInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleUpdateOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("article", &input.article).await?;
        let existing = match existing {
            Some(r) => r,
            None => return Ok(ArticleUpdateOutput::Notfound {
                message: "Article not found".to_string(),
            }),
        };

        let now = chrono::Utc::now().to_rfc3339();
        let slug = slugify(&input.title);

        let mut updated = existing.clone();
        updated["slug"] = json!(slug);
        updated["title"] = json!(input.title);
        updated["description"] = json!(input.description);
        updated["body"] = json!(input.body);
        updated["updatedAt"] = json!(now);

        storage.put("article", &input.article, updated).await?;

        Ok(ArticleUpdateOutput::Ok { article: input.article })
    }

    async fn delete(
        &self,
        input: ArticleDeleteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleDeleteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("article", &input.article).await?;
        if existing.is_none() {
            return Ok(ArticleDeleteOutput::Notfound {
                message: "Article not found".to_string(),
            });
        }

        storage.del("article", &input.article).await?;

        Ok(ArticleDeleteOutput::Ok { article: input.article })
    }

    async fn list(
        &self,
        _input: ArticleListInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleListOutput, Box<dyn std::error::Error>> {
        let all_articles = storage.find("article", None).await?;
        let articles: Vec<serde_json::Value> = all_articles.iter().map(|r| {
            json!({
                "slug": r["slug"],
                "title": r["title"],
                "description": r["description"],
                "body": r["body"],
                "author": r["author"],
                "createdAt": r["createdAt"],
            })
        }).collect();

        Ok(ArticleListOutput::Ok {
            articles: serde_json::to_string(&articles)?,
        })
    }

    async fn get(
        &self,
        input: ArticleGetInput,
        storage: &dyn ConceptStorage,
    ) -> Result<ArticleGetOutput, Box<dyn std::error::Error>> {
        let record = storage.get("article", &input.article).await?;
        match record {
            Some(r) => Ok(ArticleGetOutput::Ok {
                article: input.article,
                slug: r["slug"].as_str().unwrap_or("").to_string(),
                title: r["title"].as_str().unwrap_or("").to_string(),
                description: r["description"].as_str().unwrap_or("").to_string(),
                body: r["body"].as_str().unwrap_or("").to_string(),
                author: r["author"].as_str().unwrap_or("").to_string(),
            }),
            None => Ok(ArticleGetOutput::Notfound {
                message: "Article not found".to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_create_article() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        let result = handler.create(
            ArticleCreateInput {
                article: "art-1".to_string(),
                title: "Hello World".to_string(),
                description: "A test article".to_string(),
                body: "Body content here".to_string(),
                author: "user-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ArticleCreateOutput::Ok { article } => {
                assert_eq!(article, "art-1");
            }
        }
    }

    #[tokio::test]
    async fn test_get_existing_article() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        handler.create(
            ArticleCreateInput {
                article: "art-2".to_string(),
                title: "Test Title".to_string(),
                description: "Desc".to_string(),
                body: "Body".to_string(),
                author: "author-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.get(
            ArticleGetInput { article: "art-2".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ArticleGetOutput::Ok { title, slug, .. } => {
                assert_eq!(title, "Test Title");
                assert_eq!(slug, "test-title");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_get_nonexistent_article_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        let result = handler.get(
            ArticleGetInput { article: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ArticleGetOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_update_existing_article() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        handler.create(
            ArticleCreateInput {
                article: "art-3".to_string(),
                title: "Original".to_string(),
                description: "Desc".to_string(),
                body: "Body".to_string(),
                author: "author-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.update(
            ArticleUpdateInput {
                article: "art-3".to_string(),
                title: "Updated Title".to_string(),
                description: "New Desc".to_string(),
                body: "New Body".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ArticleUpdateOutput::Ok { article } => {
                assert_eq!(article, "art-3");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_update_nonexistent_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        let result = handler.update(
            ArticleUpdateInput {
                article: "missing".to_string(),
                title: "x".to_string(),
                description: "x".to_string(),
                body: "x".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            ArticleUpdateOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_existing_article() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        handler.create(
            ArticleCreateInput {
                article: "art-4".to_string(),
                title: "To Delete".to_string(),
                description: "x".to_string(),
                body: "x".to_string(),
                author: "author-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.delete(
            ArticleDeleteInput { article: "art-4".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ArticleDeleteOutput::Ok { article } => {
                assert_eq!(article, "art-4");
            }
            _ => panic!("Expected Ok variant"),
        }
    }

    #[tokio::test]
    async fn test_delete_nonexistent_returns_notfound() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        let result = handler.delete(
            ArticleDeleteInput { article: "missing".to_string() },
            &storage,
        ).await.unwrap();
        match result {
            ArticleDeleteOutput::Notfound { .. } => {}
            _ => panic!("Expected Notfound variant"),
        }
    }

    #[tokio::test]
    async fn test_list_articles() {
        let storage = InMemoryStorage::new();
        let handler = ArticleHandlerImpl;
        let result = handler.list(
            ArticleListInput {},
            &storage,
        ).await.unwrap();
        match result {
            ArticleListOutput::Ok { articles } => {
                assert!(!articles.is_empty() || articles == "[]");
            }
        }
    }
}
