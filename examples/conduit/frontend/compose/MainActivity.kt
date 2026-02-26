// Conduit Example App -- Jetpack Compose Main Activity
// Compose activity with navigation host for Home, Login, Article, and Profile screens.

package com.clef.conduit

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.clef.conduit.data.ApiClient
import com.clef.conduit.data.User
import com.clef.conduit.ui.ArticleScreen
import com.clef.conduit.ui.HomeScreen
import com.clef.conduit.ui.LoginScreen
import com.clef.conduit.ui.ProfileScreen

val ConduitGreen = Color(0xFF5CB85C)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ConduitApp()
                }
            }
        }
    }
}

@Composable
fun ConduitApp() {
    val navController = rememberNavController()
    var currentUser by remember { mutableStateOf<User?>(null) }

    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            HomeScreen(
                user = currentUser,
                onArticleClick = { slug -> navController.navigate("article/$slug") },
                onProfileClick = { username -> navController.navigate("profile/$username") },
                onLoginClick = { navController.navigate("login") }
            )
        }

        composable("login") {
            LoginScreen(
                onLoginSuccess = { user ->
                    currentUser = user
                    navController.popBackStack()
                }
            )
        }

        composable(
            "article/{slug}",
            arguments = listOf(navArgument("slug") { type = NavType.StringType })
        ) { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: return@composable
            ArticleScreen(
                slug = slug,
                currentUser = currentUser,
                onAuthorClick = { username -> navController.navigate("profile/$username") },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            "profile/{username}",
            arguments = listOf(navArgument("username") { type = NavType.StringType })
        ) { backStackEntry ->
            val username = backStackEntry.arguments?.getString("username") ?: return@composable
            ProfileScreen(
                username = username,
                currentUser = currentUser,
                onArticleClick = { slug -> navController.navigate("article/$slug") },
                onLogout = {
                    ApiClient.clearAuth()
                    currentUser = null
                    navController.popBackStack("home", inclusive = false)
                },
                onBack = { navController.popBackStack() }
            )
        }
    }
}
