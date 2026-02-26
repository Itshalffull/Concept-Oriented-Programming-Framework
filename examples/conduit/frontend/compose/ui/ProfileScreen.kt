// Conduit Example App -- Jetpack Compose Profile Screen
// User profile with bio, follow/unfollow, and authored articles list.

package com.clef.conduit.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.clef.conduit.ConduitGreen
import com.clef.conduit.data.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    username: String,
    currentUser: User?,
    onArticleClick: (String) -> Unit,
    onLogout: () -> Unit,
    onBack: () -> Unit
) {
    var profile by remember { mutableStateOf<Profile?>(null) }
    var articles by remember { mutableStateOf<List<Article>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val isOwnProfile = currentUser?.username == username

    fun loadData() {
        scope.launch {
            try {
                isLoading = true
                errorMessage = null
                val profileRes = ApiClient.api.getProfile(username).getOrThrow()
                val articlesRes = ApiClient.api.getArticles().getOrThrow()
                profile = profileRes.profile
                articles = articlesRes.articles.filter { it.author.username == username }
            } catch (e: Exception) {
                errorMessage = e.message ?: "Failed to load profile"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(username) { loadData() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(username) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ConduitGreen,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                actions = {
                    if (isOwnProfile) {
                        IconButton(onClick = onLogout) {
                            Icon(
                                Icons.AutoMirrored.Filled.Logout,
                                contentDescription = "Sign Out",
                                tint = MaterialTheme.colorScheme.onPrimary
                            )
                        }
                    }
                }
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
                profile != null -> {
                    LazyColumn {
                        // Profile header
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Surface(
                                    modifier = Modifier.size(80.dp).clip(CircleShape),
                                    color = ConduitGreen
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            username.first().uppercaseChar().toString(),
                                            style = MaterialTheme.typography.headlineLarge,
                                            color = MaterialTheme.colorScheme.onPrimary
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                Text(
                                    username,
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold
                                )

                                profile?.bio?.let { bio ->
                                    if (bio.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            bio,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }

                                if (!isOwnProfile) {
                                    Spacer(modifier = Modifier.height(16.dp))
                                    OutlinedButton(onClick = {
                                        scope.launch {
                                            try {
                                                val res = if (profile!!.following)
                                                    ApiClient.api.unfollow(username).getOrThrow()
                                                else
                                                    ApiClient.api.follow(username).getOrThrow()
                                                profile = res.profile
                                            } catch (_: Exception) {}
                                        }
                                    }) {
                                        Text(
                                            if (profile!!.following) "Unfollow" else "Follow"
                                        )
                                    }
                                }
                            }
                        }

                        // Section header
                        item {
                            HorizontalDivider()
                            Text(
                                "Articles by $username",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(16.dp)
                            )
                        }

                        if (articles.isEmpty()) {
                            item {
                                Text(
                                    "No articles yet.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(16.dp)
                                )
                            }
                        }

                        items(articles, key = { it.slug }) { article ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 4.dp)
                                    .clickable { onArticleClick(article.slug) }
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        article.title,
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        article.description,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        article.createdAt.take(10),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
