// generated: favorite/types.rs

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteFavoriteInput {
    pub user: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteFavoriteOutput {
    Ok {
        user: String,
        article: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteUnfavoriteInput {
    pub user: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteUnfavoriteOutput {
    Ok {
        user: String,
        article: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteIsFavoritedInput {
    pub user: String,
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteIsFavoritedOutput {
    Ok {
        favorited: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FavoriteCountInput {
    pub article: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "variant")]
pub enum FavoriteCountOutput {
    Ok {
        count: i64,
    },
}

