// Favorite Concept Implementation (Rust)
//
// Mirrors the TypeScript favorite.impl.ts — favorite, unfavorite,
// is_favorited, count actions.

use crate::storage::{ConceptStorage, StorageResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteFavoriteInput {
    pub user: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteFavoriteOutput {
    #[serde(rename = "ok")]
    Ok { user: String, article: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteUnfavoriteInput {
    pub user: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteUnfavoriteOutput {
    #[serde(rename = "ok")]
    Ok { user: String, article: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteIsFavoritedInput {
    pub user: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteIsFavoritedOutput {
    #[serde(rename = "ok")]
    Ok { favorited: bool },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteCountInput {
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteCountOutput {
    #[serde(rename = "ok")]
    Ok { count: i64 },
}

// ── Handler ────────────────────────────────────────────────

pub struct FavoriteHandler;

impl FavoriteHandler {
    fn parse_favorites(record: &serde_json::Value) -> Vec<String> {
        record["favorites"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub async fn favorite(
        &self,
        input: FavoriteFavoriteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FavoriteFavoriteOutput> {
        let existing = storage.get("favorite", &input.user).await?;

        let mut favorites = match &existing {
            Some(record) => Self::parse_favorites(record),
            None => vec![],
        };

        if !favorites.contains(&input.article) {
            favorites.push(input.article.clone());
        }

        storage
            .put(
                "favorite",
                &input.user,
                json!({ "user": input.user, "favorites": favorites }),
            )
            .await?;

        Ok(FavoriteFavoriteOutput::Ok {
            user: input.user,
            article: input.article,
        })
    }

    pub async fn unfavorite(
        &self,
        input: FavoriteUnfavoriteInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FavoriteUnfavoriteOutput> {
        let existing = storage.get("favorite", &input.user).await?;

        if let Some(record) = existing {
            let favorites: Vec<String> = Self::parse_favorites(&record)
                .into_iter()
                .filter(|a| a != &input.article)
                .collect();

            storage
                .put(
                    "favorite",
                    &input.user,
                    json!({ "user": input.user, "favorites": favorites }),
                )
                .await?;
        }

        Ok(FavoriteUnfavoriteOutput::Ok {
            user: input.user,
            article: input.article,
        })
    }

    pub async fn is_favorited(
        &self,
        input: FavoriteIsFavoritedInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FavoriteIsFavoritedOutput> {
        let existing = storage.get("favorite", &input.user).await?;

        let favorites = match &existing {
            Some(record) => Self::parse_favorites(record),
            None => vec![],
        };

        Ok(FavoriteIsFavoritedOutput::Ok {
            favorited: favorites.contains(&input.article),
        })
    }

    pub async fn count(
        &self,
        input: FavoriteCountInput,
        storage: &dyn ConceptStorage,
    ) -> StorageResult<FavoriteCountOutput> {
        let all_users = storage.find("favorite", None).await?;
        let mut count: i64 = 0;

        for record in &all_users {
            let favorites = Self::parse_favorites(record);
            if favorites.contains(&input.article) {
                count += 1;
            }
        }

        Ok(FavoriteCountOutput::Ok { count })
    }
}

// ── Tests ──────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::InMemoryStorage;

    #[tokio::test]
    async fn favorite_and_is_favorited() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandler;

        handler
            .favorite(
                FavoriteFavoriteInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .is_favorited(
                FavoriteIsFavoritedInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            FavoriteIsFavoritedOutput::Ok { favorited } if favorited
        ));
    }

    #[tokio::test]
    async fn unfavorite() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandler;

        handler
            .favorite(
                FavoriteFavoriteInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .unfavorite(
                FavoriteUnfavoriteInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .is_favorited(
                FavoriteIsFavoritedInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            FavoriteIsFavoritedOutput::Ok { favorited } if !favorited
        ));
    }

    #[tokio::test]
    async fn favorite_idempotent() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandler;

        handler
            .favorite(
                FavoriteFavoriteInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .favorite(
                FavoriteFavoriteInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        // Count should still be 1
        let result = handler
            .count(
                FavoriteCountInput {
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, FavoriteCountOutput::Ok { count } if count == 1));
    }

    #[tokio::test]
    async fn count_multiple_users() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandler;

        handler
            .favorite(
                FavoriteFavoriteInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .favorite(
                FavoriteFavoriteInput {
                    user: "bob".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        handler
            .favorite(
                FavoriteFavoriteInput {
                    user: "carol".into(),
                    article: "a2".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        let result = handler
            .count(
                FavoriteCountInput {
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(result, FavoriteCountOutput::Ok { count } if count == 2));
    }

    #[tokio::test]
    async fn is_favorited_when_not() {
        let storage = InMemoryStorage::new();
        let handler = FavoriteHandler;

        let result = handler
            .is_favorited(
                FavoriteIsFavoritedInput {
                    user: "alice".into(),
                    article: "a1".into(),
                },
                &storage,
            )
            .await
            .unwrap();

        assert!(matches!(
            result,
            FavoriteIsFavoritedOutput::Ok { favorited } if !favorited
        ));
    }
}
