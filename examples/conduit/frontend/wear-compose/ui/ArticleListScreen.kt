// Conduit Example App -- Wear OS Compose Article List Screen
// Scrollable list of articles optimized for the round watch display.

package com.copf.conduit.wear.ui

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.copf.conduit.wear.data.WearApiClient
import com.copf.conduit.wear.data.WearArticle
import kotlinx.coroutines.launch

@Composable
fun ArticleListScreen(onArticleClick: (String) -> Unit) {
    var articles by remember { mutableStateOf<List<WearArticle>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val listState = rememberScalingLazyListState()

    LaunchedEffect(Unit) {
        try {
            isLoading = true
            errorMessage = null
            val response = WearApiClient.api.getArticles()
            if (response.isSuccessful) {
                articles = response.body()?.articles ?: emptyList()
            } else {
                errorMessage = "HTTP ${response.code()}"
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Failed to load"
        } finally {
            isLoading = false
        }
    }

    when {
        isLoading -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        }
        errorMessage != null -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Error",
                        style = MaterialTheme.typography.title3,
                        color = MaterialTheme.colors.error
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = errorMessage ?: "",
                        style = MaterialTheme.typography.caption3,
                        color = MaterialTheme.colors.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Chip(
                        onClick = {
                            scope.launch {
                                isLoading = true
                                try {
                                    val response = WearApiClient.api.getArticles()
                                    if (response.isSuccessful) {
                                        articles = response.body()?.articles ?: emptyList()
                                        errorMessage = null
                                    }
                                } catch (_: Exception) {}
                                isLoading = false
                            }
                        },
                        label = { Text("Retry") },
                        colors = ChipDefaults.primaryChipColors()
                    )
                }
            }
        }
        articles.isEmpty -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No articles",
                    style = MaterialTheme.typography.body2,
                    color = MaterialTheme.colors.onSurfaceVariant
                )
            }
        }
        else -> {
            ScalingLazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    top = 24.dp,
                    start = 8.dp,
                    end = 8.dp,
                    bottom = 8.dp
                )
            ) {
                item {
                    ListHeader {
                        Text(
                            text = "Conduit",
                            style = MaterialTheme.typography.title3,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                items(articles, key = { it.slug }) { article ->
                    Chip(
                        onClick = { onArticleClick(article.slug) },
                        label = {
                            Text(
                                text = article.title,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                style = MaterialTheme.typography.caption1,
                                fontWeight = FontWeight.SemiBold
                            )
                        },
                        secondaryLabel = {
                            Text(
                                text = "${article.author.username} \u00B7 \u2665 ${article.favoritesCount}",
                                style = MaterialTheme.typography.caption3
                            )
                        },
                        colors = ChipDefaults.secondaryChipColors(),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}
