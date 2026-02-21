// Conduit Example App -- Wear OS Compose Main Activity
// Wear OS activity with SwipeDismissableNavHost for article browsing.

package com.copf.conduit.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.copf.conduit.wear.ui.ArticleDetailScreen
import com.copf.conduit.wear.ui.ArticleListScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                WearConduitApp()
            }
        }
    }
}

@Composable
fun WearConduitApp() {
    val navController = rememberSwipeDismissableNavController()

    SwipeDismissableNavHost(
        navController = navController,
        startDestination = "articles"
    ) {
        composable("articles") {
            ArticleListScreen(
                onArticleClick = { slug ->
                    navController.navigate("article/$slug")
                }
            )
        }

        composable("article/{slug}") { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: return@composable
            ArticleDetailScreen(slug = slug)
        }
    }
}
