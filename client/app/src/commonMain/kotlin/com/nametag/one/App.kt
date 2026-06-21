package com.nametag.one

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.nametag.one.core.ui.theme.NametagTheme
import com.nametag.one.feature.auth.login.LoginScreen
import com.nametag.one.feature.auth.splash.SplashScreen
import com.nametag.one.navigation.Routes
import kotlinx.coroutines.delay

@Composable
fun App() {
    NametagTheme {
        val navController = rememberNavController()

        NavHost(
            navController = navController,
            startDestination = Routes.Splash.name,
        ) {
            composable(Routes.Splash.name) {
                SplashScreen()

                LaunchedEffect(Unit) {
                    delay(2500)
                    navController.navigate(Routes.Login.name) {
                        popUpTo(Routes.Splash.name) { inclusive = true }
                    }
                }
            }
            composable(Routes.Login.name) {
                LoginScreen()
            }
        }
    }
}
