// generated: favorite/handler.rs

use async_trait::async_trait;
use crate::storage::ConceptStorage;
use super::types::*;

#[async_trait]
pub trait FavoriteHandler: Send + Sync {
    async fn favorite(
        &self,
        input: FavoriteFavoriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteFavoriteOutput, Box<dyn std::error::Error>>;

    async fn unfavorite(
        &self,
        input: FavoriteUnfavoriteInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteUnfavoriteOutput, Box<dyn std::error::Error>>;

    async fn is_favorited(
        &self,
        input: FavoriteIsFavoritedInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteIsFavoritedOutput, Box<dyn std::error::Error>>;

    async fn count(
        &self,
        input: FavoriteCountInput,
        storage: &dyn ConceptStorage,
    ) -> Result<FavoriteCountOutput, Box<dyn std::error::Error>>;

}
