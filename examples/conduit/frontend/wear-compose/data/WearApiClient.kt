// Conduit Example App -- Wear OS Compose API Client
// Retrofit-based HTTP client with compact models for Wear OS.

package com.copf.conduit.wear.data

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

// Compact models for watch display
data class WearArticle(
    val slug: String,
    val title: String,
    val description: String,
    val body: String,
    val createdAt: String,
    val favoritesCount: Int = 0,
    val author: WearProfile
)

data class WearProfile(
    val username: String,
    val bio: String? = null
)

data class WearArticlesResponse(
    val articles: List<WearArticle>,
    val articlesCount: Int
)

data class WearArticleResponse(
    val article: WearArticle
)

interface WearConduitApi {
    @GET("/api/articles")
    suspend fun getArticles(): Response<WearArticlesResponse>

    @GET("/api/articles/{slug}")
    suspend fun getArticle(@Path("slug") slug: String): Response<WearArticleResponse>

    @POST("/api/articles/{slug}/favorite")
    suspend fun favorite(@Path("slug") slug: String): Response<WearArticleResponse>

    @DELETE("/api/articles/{slug}/favorite")
    suspend fun unfavorite(@Path("slug") slug: String): Response<WearArticleResponse>
}

object WearApiClient {
    private const val BASE_URL = "http://localhost:3000"
    var token: String? = null

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
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    val api: WearConduitApi = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(WearConduitApi::class.java)
}
