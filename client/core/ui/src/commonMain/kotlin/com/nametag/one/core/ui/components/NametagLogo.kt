package com.nametag.one.core.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nametag.one.core.ui.theme.NametagRed
import com.nametag.one.core.ui.theme.PermanentMarkerFamily
import kotlinx.coroutines.delay

private val NAMES = listOf(
    "Dmitri", "Sarah", "Kenji", "Amara", "Luca",
    "Fatima", "Maya", "Carlos", "Yuki", "Priya",
    "Oliver", "Zara", "Mateo", "Aisha", "Noah",
)

@Composable
fun NametagLogo(
    modifier: Modifier = Modifier,
    size: LogoSize = LogoSize.Large,
) {
    var currentIndex by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(2000)
            currentIndex = (currentIndex + 1) % NAMES.size
        }
    }

    val width = when (size) {
        LogoSize.Large -> 220.dp
        LogoSize.Small -> 140.dp
    }
    val helloFontSize = when (size) {
        LogoSize.Large -> 28.sp
        LogoSize.Small -> 16.sp
    }
    val myNameFontSize = when (size) {
        LogoSize.Large -> 14.sp
        LogoSize.Small -> 8.sp
    }
    val nameFontSize = when (size) {
        LogoSize.Large -> 30.sp
        LogoSize.Small -> 18.sp
    }
    val whiteBoxHeight = when (size) {
        LogoSize.Large -> 56.dp
        LogoSize.Small -> 36.dp
    }
    val topPaddingVertical = when (size) {
        LogoSize.Large -> 12.dp
        LogoSize.Small -> 6.dp
    }
    val outerPadding = when (size) {
        LogoSize.Large -> 12.dp
        LogoSize.Small -> 8.dp
    }

    Column(
        modifier = modifier
            .width(width)
            .clip(RoundedCornerShape(14.dp))
            .background(NametagRed),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            modifier = Modifier.padding(vertical = topPaddingVertical),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "HELLO",
                color = Color.White,
                fontSize = helloFontSize,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 2.sp,
            )
            Text(
                text = "MY NAME IS",
                color = Color.White,
                fontSize = myNameFontSize,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.sp,
            )
        }
        Box(
            modifier = Modifier
                .padding(start = outerPadding, end = outerPadding, bottom = outerPadding)
                .fillMaxWidth()
                .height(whiteBoxHeight)
                .clip(RoundedCornerShape(4.dp))
                .background(Color.White),
            contentAlignment = Alignment.Center,
        ) {
            AnimatedContent(
                targetState = NAMES[currentIndex],
                transitionSpec = {
                    fadeIn(initialAlpha = 0f) togetherWith fadeOut(targetAlpha = 0f)
                },
            ) { name ->
                Text(
                    text = name,
                    fontFamily = PermanentMarkerFamily(),
                    fontSize = nameFontSize,
                    color = Color(0xFF1A1A1A),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

enum class LogoSize { Large, Small }
