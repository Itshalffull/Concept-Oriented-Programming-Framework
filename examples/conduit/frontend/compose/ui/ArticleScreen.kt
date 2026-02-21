// Conduit Example App -- Jetpack Compose Article Detail Screen
// Full article content with author info, comments, and social actions.

package com.copf.conduit.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.copf.conduit.ConduitGreen
import com.copf.conduit.data.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleScreen(
    slug: String,
    currentUser: User?,
    onAuthorClick: (String) -> Unit,
    onBack: () -> Unit
) {
    var article by remember { mutableStateOf<Article?>(null) }
    var comments by remember { mutableStateOf<List<Comment>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var newComment by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun loadData() {
        scope.launch {
            try {
                isLoading = true
                errorMessage = null
                val articleRes = ApiClient.api.getArticle(slug).getOrThrow()
                val commentsRes = ApiClient.api.getComments(slug).getOrThrow()
                article = articleRes.article
                comments = commentsRes.comments
            } catch (e: Exception) {
                errorMessage = e.message ?: "Failed to load article"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(slug) { loadData() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Article") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ConduitGreen,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = ConduitGreen
                    )
                }
                errorMessage != null -> {
                    Text(
                        errorMessage ?: "",
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.error
                    )
                }
                article != null -> {
                    val art = article!!
                    LazyColumn(contentPadding = PaddingValues(0.dp)) {
                        // Header
                        item {
                            Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        art.title,
                                        style = MaterialTheme.typography.headlineSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            art.author.username,
                                            color = ConduitGreen,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.clickable { onAuthorClick(art.author.username) }
                                        )
                                        Text(
                                            art.createdAt.take(10),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedButton(onClick = {
                                            scope.launch {
                                                try {
                                                    val res = if (art.author.following)
                                                        ApiClient.api.unfollow(art.author.username).getOrThrow()
                                                    else
                                                        ApiClient.api.follow(art.author.username).getOrThrow()
                                                    article = art.copy(author = res.profile)
                                                } catch (_: Exception) {}
                                            }
                                        }) {
                                            Icon(
                                                if (art.author.following) Icons.Default.PersonRemove else Icons.Default.PersonAdd,
                                                contentDescription = null,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(if (art.author.following) "Unfollow" else "Follow")
                                        }
                                        OutlinedButton(onClick = {
                                            scope.launch {
                                                try {
                                                    val res = if (art.favorited)
                                                        ApiClient.api.unfavorite(slug).getOrThrow()
                                                    else
                                                        ApiClient.api.favorite(slug).getOrThrow()
                                                    article = res.article
                                                } catch (_: Exception) {}
                                            }
                                        }) {
                                            Icon(
                                                if (art.favorited) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                                                contentDescription = null,
                                                modifier = Modifier.size(16.dp),
                                                tint = if (art.favorited) MaterialTheme.colorScheme.error else LocalContentColor.current
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("${art.favoritesCount}")
                                        }
                                    }
                                }
                            }
                        }

                        // Body
                        item {
                            Text(
                                art.body,
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.padding(16.dp)
                            )
                        }

                        // Tags
                        if (art.tagList.isNotEmpty()) {
                            item {
                                Row(
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    art.tagList.forEach { tag ->
                                        SuggestionChip(
                                            onClick = {},
                                            label = { Text(tag, style = MaterialTheme.typography.labelSmall) },
                                            modifier = Modifier.height(24.dp)
                                        )
                                    }
                                }
                            }
                        }

                        // Divider
                        item {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))
                            Text(
                                "Comments",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                        }

                        // Comment input
                        if (currentUser != null) {
                            item {
                                Row(
                                    modifier = Modifier.padding(horizontal = 16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    OutlinedTextField(
                                        value = newComment,
                                        onValueChange = { newComment = it },
                                        label = { Text("Write a comment...") },
                                        enabled = !isSubmitting,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    IconButton(
                                        onClick = {
                                            if (newComment.isNotBlank()) {
                                                scope.launch {
                                                    isSubmitting = true
                                                    try {
                                                        val res = ApiClient.api.createComment(
                                                            slug,
                                                            CreateCommentRequest(CreateCommentBody(newComment))
                                                        ).getOrThrow()
                                                        comments = listOf(res.comment) + comments
                                                        newComment = ""
                                                    } catch (_: Exception) {}
                                                    isSubmitting = false
                                                }
                                            }
                                        },
                                        enabled = newComment.isNotBlank() && !isSubmitting
                                    ) {
                                        Icon(Icons.Default.Send, contentDescription = "Post", tint = ConduitGreen)
                                    }
                                }
                                Spacer(modifier = Modifier.height(12.dp))
                            }
                        }

                        // Comments list
                        items(comments, key = { it.id }) { comment ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 4.dp)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(comment.body, style = MaterialTheme.typography.bodyMedium)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            comment.author.username,
                                            color = ConduitGreen,
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                        Row {
                                            Text(
                                                comment.createdAt.take(10),
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                            if (currentUser?.username == comment.author.username) {
                                                Spacer(modifier = Modifier.width(8.dp))
                                                IconButton(
                                                    onClick = {
                                                        scope.launch {
                                                            try {
                                                                ApiClient.api.deleteComment(slug, comment.id)
                                                                comments = comments.filter { it.id != comment.id }
                                                            } catch (_: Exception) {}
                                                        }
                                                    },
                                                    modifier = Modifier.size(20.dp)
                                                ) {
                                                    Icon(
                                                        Icons.Default.Delete,
                                                        contentDescription = "Delete",
                                                        tint = MaterialTheme.colorScheme.error,
                                                        modifier = Modifier.size(16.dp)
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (comments.isEmpty()) {
                            item {
                                Text(
                                    "No comments yet.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(16.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
