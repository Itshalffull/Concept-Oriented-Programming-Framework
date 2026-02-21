// Conduit Example App -- GTK API Client
// reqwest-based HTTP client for the Conduit REST API.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

const BASE_URL: &str = "http://localhost:3000";

// MARK: - Models

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub email: String,
    pub token: String,
    pub bio: Option<String>,
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub username: String,
    pub bio: Option<String>,
    pub image: Option<String>,
    pub following: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub body: String,
    #[serde(rename = "tagList")]
    pub tag_list: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub favorited: bool,
    #[serde(rename = "favoritesCount")]
    pub favorites_count: i32,
    pub author: Profile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: String,
    pub body: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub author: Profile,
}

// Response wrappers
#[derive(Debug, Deserialize)]
pub struct UserResponse {
    pub user: User,
}

#[derive(Debug, Deserialize)]
pub struct ArticlesResponse {
    pub articles: Vec<Article>,
    #[serde(rename = "articlesCount")]
    pub articles_count: i32,
}

#[derive(Debug, Deserialize)]
pub struct ArticleResponse {
    pub article: Article,
}

#[derive(Debug, Deserialize)]
pub struct CommentsResponse {
    pub comments: Vec<Comment>,
}

#[derive(Debug, Deserialize)]
pub struct ProfileResponse {
    pub profile: Profile,
}

#[derive(Debug, Deserialize)]
pub struct TagsResponse {
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ErrorBody {
    pub body: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ErrorResponse {
    pub errors: ErrorBody,
}

// Request bodies
#[derive(Serialize)]
struct LoginWrapper {
    user: LoginBody,
}

#[derive(Serialize)]
struct LoginBody {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct RegisterWrapper {
    user: RegisterBody,
}

#[derive(Serialize)]
struct RegisterBody {
    username: String,
    email: String,
    password: String,
}

// MARK: - API Client

#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    token: Arc<Mutex<Option<String>>>,
}

impl ApiClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            token: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_token(&self, token: Option<String>) {
        *self.token.lock().unwrap() = token;
    }

    pub fn get_token(&self) -> Option<String> {
        self.token.lock().unwrap().clone()
    }

    fn auth_header(&self) -> Option<String> {
        self.get_token().map(|t| format!("Token {}", t))
    }

    // Auth
    pub async fn login(&self, email: &str, password: &str) -> Result<User, String> {
        let body = LoginWrapper {
            user: LoginBody {
                email: email.to_string(),
                password: password.to_string(),
            },
        };

        let mut req = self.client.post(format!("{}/api/users/login", BASE_URL)).json(&body);
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            let err: ErrorResponse = response.json().await.map_err(|e| e.to_string())?;
            return Err(err.errors.body.join(", "));
        }
        let res: UserResponse = response.json().await.map_err(|e| e.to_string())?;
        self.set_token(Some(res.user.token.clone()));
        Ok(res.user)
    }

    pub async fn register(&self, username: &str, email: &str, password: &str) -> Result<User, String> {
        let body = RegisterWrapper {
            user: RegisterBody {
                username: username.to_string(),
                email: email.to_string(),
                password: password.to_string(),
            },
        };

        let response = self.client.post(format!("{}/api/users", BASE_URL))
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            let err: ErrorResponse = response.json().await.map_err(|e| e.to_string())?;
            return Err(err.errors.body.join(", "));
        }
        let res: UserResponse = response.json().await.map_err(|e| e.to_string())?;
        self.set_token(Some(res.user.token.clone()));
        Ok(res.user)
    }

    // Articles
    pub async fn get_articles(&self) -> Result<Vec<Article>, String> {
        let mut req = self.client.get(format!("{}/api/articles", BASE_URL));
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let res: ArticlesResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(res.articles)
    }

    pub async fn get_article(&self, slug: &str) -> Result<Article, String> {
        let mut req = self.client.get(format!("{}/api/articles/{}", BASE_URL, slug));
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let res: ArticleResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(res.article)
    }

    // Social
    pub async fn favorite(&self, slug: &str) -> Result<Article, String> {
        let mut req = self.client.post(format!("{}/api/articles/{}/favorite", BASE_URL, slug));
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let res: ArticleResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(res.article)
    }

    pub async fn unfavorite(&self, slug: &str) -> Result<Article, String> {
        let mut req = self.client.delete(format!("{}/api/articles/{}/favorite", BASE_URL, slug));
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let res: ArticleResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(res.article)
    }

    pub async fn get_profile(&self, username: &str) -> Result<Profile, String> {
        let mut req = self.client.get(format!("{}/api/profiles/{}", BASE_URL, username));
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let res: ProfileResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(res.profile)
    }

    pub async fn get_comments(&self, slug: &str) -> Result<Vec<Comment>, String> {
        let mut req = self.client.get(format!("{}/api/articles/{}/comments", BASE_URL, slug));
        if let Some(auth) = self.auth_header() {
            req = req.header("Authorization", auth);
        }

        let response = req.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let res: CommentsResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(res.comments)
    }

    pub async fn get_tags(&self) -> Result<Vec<String>, String> {
        let response = self.client.get(format!("{}/api/tags", BASE_URL))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }
        let res: TagsResponse = response.json().await.map_err(|e| e.to_string())?;
        Ok(res.tags)
    }
}
