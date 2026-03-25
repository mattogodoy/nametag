package com.nametag.one.feature.auth.splash

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nametag.one.core.ui.components.LoadingIndicator
import com.nametag.one.core.ui.components.LogoSize
import com.nametag.one.core.ui.components.NametagLogo

@Composable
fun SplashScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        NametagLogo(size = LogoSize.Large)

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "nametag",
            fontSize = 32.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
            letterSpacing = (-0.5).sp,
        )

        Spacer(modifier = Modifier.height(32.dp))

        LoadingIndicator()
    }
}
