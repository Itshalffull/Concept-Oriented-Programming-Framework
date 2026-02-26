// Conduit Example App -- Jetpack Compose API Service
// Retrofit-based HTTP client for the Conduit REST API.

package com.clef.conduit.data

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

interface ConduitApi {
    // Auth
    @POST("/api/users")
    suspend fun register(@Body body: RegisterRequest): Response<UserResponse>

    @POST("/api/users/login")
    suspend fun login(@Body body: LoginRequest): Response<UserResponse>

    // Profile
    @PUT("/api/user")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): Response<UserResponse>

    @GET("/api/profiles/{username}")
    suspend fun getProfile(@Path("username") username: String): Response<ProfileResponse>

    // Articles
    @GET("/api/articles")
    suspend fun getArticles(): Response<ArticlesResponse>

    @GET("/api/articles/{slug}")
    suspend fun getArticle(@Path("slug") slug: String): Response<ArticleResponse>

    @POST("/api/articles")
    suspend fun createArticle(@Body body: CreateArticleRequest): Response<ArticleResponse>

    @DELETE("/api/articles/{slug}")
    suspend fun deleteArticle(@Path("slug") slug: String): Response<Unit>

    // Comments
    @GET("/api/articles/{slug}/comments")
    suspend fun getComments(@Path("slug") slug: String): Response<CommentsResponse>

    @POST("/api/articles/{slug}/comments")
    suspend fun createComment(
        @Path("slug") slug: String,
        @Body body: CreateCommentRequest
    ): Response<CommentResponse>

    @DELETE("/api/articles/{slug}/comments/{id}")
    suspend fun deleteComment(
        @Path("slug") slug: String,
        @Path("id") id: String
    ): Response<Unit>

    // Social
    @POST("/api/profiles/{username}/follow")
    suspend fun follow(@Path("username") username: String): Response<ProfileResponse>

    @DELETE("/api/profiles/{username}/follow")
    suspend fun unfollow(@Path("username") username: String): Response<ProfileResponse>

    @POST("/api/articles/{slug}/favorite")
    suspend fun favorite(@Path("slug") slug: String): Response<ArticleResponse>

    @DELETE("/api/articles/{slug}/favorite")
    suspend fun unfavorite(@Path("slug") slug: String): Response<ArticleResponse>

    // Tags
    @GET("/api/tags")
    suspend fun getTags(): Response<TagsResponse>
}

object ApiClient {
    private const val BASE_URL = "http://localhost:3000"
    var token: String? = null
    var currentUser: User? = null

    private val authInterceptor = Interceptor { chain ->
        val builder = chain.request().newBuilder()
            .addHeader("Content-Type", "application/json")
        token?.let {
            builder.addHeader("Authorization", "Token $it")
        }
        chain.proceed(builder.build())
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .build()

    val api: ConduitApi = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(ConduitApi::class.java)

    fun setAuth(user: User) {
        token = user.token
        currentUser = user
    }

    fun clearAuth() {
        token = null
        currentUser = null
    }

    val isAuthenticated: Boolean get() = token != null
}

// Extension to safely unwrap responses
suspend fun <T> Response<T>.getOrThrow(): T {
    if (isSuccessful) {
        return body() ?: throw Exception("Empty response body")
    }
    val errorBody = errorBody()?.string() ?: "Unknown error"
    throw Exception("HTTP ${code()}: $errorBody")
}
