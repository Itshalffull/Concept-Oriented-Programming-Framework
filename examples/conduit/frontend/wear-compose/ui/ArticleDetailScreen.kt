// Conduit Example App -- Wear OS Compose Article Detail Screen
// Compact article reader for the watch display with truncated body text.

package com.copf.conduit.wear.ui

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.copf.conduit.wear.data.WearApiClient
import com.copf.conduit.wear.data.WearArticle

@Composable
fun ArticleDetailScreen(slug: String) {
    var article by remember { mutableStateOf<WearArticle?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(slug) {
        try {
            isLoading = true
            errorMessage = null
            val response = WearApiClient.api.getArticle(slug)
            if (response.isSuccessful) {
                article = response.body()?.article
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
                Text(
                    text = errorMessage ?: "Error",
                    style = MaterialTheme.typography.caption3,
                    color = MaterialTheme.colors.error
                )
            }
        }
        article != null -> {
            val art = article!!
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
                // Title
                item {
                    Text(
                        text = art.title,
                        style = MaterialTheme.typography.title3,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                }

                // Author and date
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = art.author.username,
                            style = MaterialTheme.typography.caption3,
                            color = MaterialTheme.colors.primary
                        )
                        Text(
                            text = art.createdAt.take(10),
                            style = MaterialTheme.typography.caption3,
                            color = MaterialTheme.colors.onSurfaceVariant
                        )
                    }
                }

                // Body (truncated)
                item {
                    val displayBody = if (art.body.length > 300) {
                        art.body.take(300) + "..."
                    } else {
                        art.body
                    }
                    Text(
                        text = displayBody,
                        style = MaterialTheme.typography.body2,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }

                // Overflow notice
                if (art.body.length > 300) {
                    item {
                        Text(
                            text = "Open on phone for full article",
                            style = MaterialTheme.typography.caption3,
                            color = MaterialTheme.colors.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )
                    }
                }

                // Favorite count
                item {
                    Chip(
                        onClick = { /* favorite action would go here */ },
                        label = { Text("\u2665 ${art.favoritesCount} favorites") },
                        colors = ChipDefaults.secondaryChipColors(),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                    )
                }
            }
        }
    }
}
