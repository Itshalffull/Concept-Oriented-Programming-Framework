// Favorite -- user favorites/bookmarks for articles with per-user tracking
// and aggregate counting across all users.

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;
use super::handler::FavoriteHandler;
use serde_json::json;

pub struct FavoriteHandlerImpl;

#[async_trait]
impl FavoriteHandler for FavoriteHandlerImpl {
    async fn favorite(
        &self,
        input: FavoriteFavoriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteFavoriteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("favorite", &input.user).await?;
        let mut favorites: Vec<String> = match &existing {
            Some(record) => {
                let arr = record["favorites"].as_array();
                match arr {
                    Some(a) => a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect(),
                    None => Vec::new(),
                }
            }
            None => Vec::new(),
        };

        if !favorites.contains(&input.article) {
            favorites.push(input.article.clone());
        }

        storage.put("favorite", &input.user, json!({
            "user": input.user,
            "favorites": favorites,
        })).await?;

        Ok(FavoriteFavoriteOutput::Ok {
            user: input.user,
            article: input.article,
        })
    }

    async fn unfavorite(
        &self,
        input: FavoriteUnfavoriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteUnfavoriteOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("favorite", &input.user).await?;
        if let Some(record) = &existing {
            let mut favorites: Vec<String> = record["favorites"]
                .as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            favorites.retain(|a| a != &input.article);

            storage.put("favorite", &input.user, json!({
                "user": input.user,
                "favorites": favorites,
            })).await?;
        }

        Ok(FavoriteUnfavoriteOutput::Ok {
            user: input.user,
            article: input.article,
        })
    }

    async fn is_favorited(
        &self,
        input: FavoriteIsFavoritedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteIsFavoritedOutput, Box<dyn std::error::Error>> {
        let existing = storage.get("favorite", &input.user).await?;
        let favorites: Vec<String> = match &existing {
            Some(record) => {
                record["favorites"]
                    .as_array()
                    .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                    .unwrap_or_default()
            }
            None => Vec::new(),
        };

        Ok(FavoriteIsFavoritedOutput::Ok {
            favorited: favorites.contains(&input.article),
        })
    }

    async fn count(
        &self,
        input: FavoriteCountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteCountOutput, Box<dyn std::error::Error>> {
        let all_users = storage.find("favorite", "{}").await?;
        let mut count: i64 = 0;

        for record in &all_users {
            if let Some(favorites) = record["favorites"].as_array() {
                for fav in favorites {
                    if fav.as_str() == Some(&input.article) {
                        count += 1;
                    }
                }
            }
        }

        Ok(FavoriteCountOutput::Ok { count })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn test_favorite() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandlerImpl;
        let result = handler.favorite(
            FavoriteFavoriteInput {
                user: "user-1".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FavoriteFavoriteOutput::Ok { user, article } => {
                assert_eq!(user, "user-1");
                assert_eq!(article, "article-1");
            },
        }
    }

    #[tokio::test]
    async fn test_unfavorite() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandlerImpl;
        handler.favorite(
            FavoriteFavoriteInput {
                user: "user-1".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.unfavorite(
            FavoriteUnfavoriteInput {
                user: "user-1".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FavoriteUnfavoriteOutput::Ok { user, article } => {
                assert_eq!(user, "user-1");
                assert_eq!(article, "article-1");
            },
        }
    }

    #[tokio::test]
    async fn test_is_favorited() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandlerImpl;
        handler.favorite(
            FavoriteFavoriteInput {
                user: "user-1".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.is_favorited(
            FavoriteIsFavoritedInput {
                user: "user-1".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FavoriteIsFavoritedOutput::Ok { favorited } => {
                assert!(favorited);
            },
        }
    }

    #[tokio::test]
    async fn test_is_not_favorited() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandlerImpl;
        let result = handler.is_favorited(
            FavoriteIsFavoritedInput {
                user: "user-1".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FavoriteIsFavoritedOutput::Ok { favorited } => {
                assert!(!favorited);
            },
        }
    }

    #[tokio::test]
    async fn test_count() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandlerImpl;
        handler.favorite(
            FavoriteFavoriteInput {
                user: "user-1".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        handler.favorite(
            FavoriteFavoriteInput {
                user: "user-2".to_string(),
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        let result = handler.count(
            FavoriteCountInput {
                article: "article-1".to_string(),
            },
            &storage,
        ).await.unwrap();
        match result {
            FavoriteCountOutput::Ok { count } => {
                assert_eq!(count, 2);
            },
        }
    }
}
