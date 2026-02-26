// Conduit Example App -- Jetpack Compose Data Models
// Data classes matching the Conduit REST API response structures.

package com.clef.conduit.data

import com.google.gson.annotations.SerializedName

data class User(
    val username: String,
    val email: String,
    val token: String,
    val bio: String? = null,
    val image: String? = null
)

data class Profile(
    val username: String,
    val bio: String? = null,
    val image: String? = null,
    val following: Boolean = false
)

data class Article(
    val slug: String,
    val title: String,
    val description: String,
    val body: String,
    val tagList: List<String> = emptyList(),
    val createdAt: String,
    val updatedAt: String,
    val favorited: Boolean = false,
    val favoritesCount: Int = 0,
    val author: Profile
)

data class Comment(
    val id: String,
    val body: String,
    val createdAt: String,
    val author: Profile
)

// Request bodies
data class LoginRequest(val user: LoginBody)
data class LoginBody(val email: String, val password: String)

data class RegisterRequest(val user: RegisterBody)
data class RegisterBody(val username: String, val email: String, val password: String)

data class CreateArticleRequest(val article: CreateArticleBody)
data class CreateArticleBody(
    val title: String,
    val description: String,
    val body: String,
    val tagList: List<String>? = null
)

data class CreateCommentRequest(val comment: CreateCommentBody)
data class CreateCommentBody(val body: String)

data class UpdateProfileRequest(val user: UpdateProfileBody)
data class UpdateProfileBody(val bio: String? = null, val image: String? = null)

// Response wrappers
data class UserResponse(val user: User)
data class ProfileResponse(val profile: Profile)
data class ArticleResponse(val article: Article)
data class ArticlesResponse(val articles: List<Article>, val articlesCount: Int)
data class CommentResponse(val comment: Comment)
data class CommentsResponse(val comments: List<Comment>)
data class TagsResponse(val tags: List<String>)
data class ErrorResponse(val errors: ErrorBody)
data class ErrorBody(val body: List<String>)
