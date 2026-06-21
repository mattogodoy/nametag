package com.nametag.one.core.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

// Brand
val NametagRed = Color(0xFFFF2600)

// Light palette
val LightPrimary = Color(0xFF1E63FF)
val LightBackground = Color(0xFFF6F7F9)
val LightSurface = Color(0xFFFFFFFF)
val LightSurfaceElevated = Color(0xFFFAFBFC)
val LightText = Color(0xFF1B1D21)
val LightMuted = Color(0x991B1D21)
val LightBorder = Color(0x261E63FF)
val LightWarning = Color(0xFFFF4800)

// Dark palette
val DarkPrimary = Color(0xFF5C82FF)
val DarkBackground = Color(0xFF0B0C10)
val DarkSurface = Color(0xFF15171D)
val DarkSurfaceElevated = Color(0xFF1D1F26)
val DarkText = Color(0xFFE7EAF0)
val DarkMuted = Color(0xA6E7EAF0)
val DarkBorder = Color(0x335C82FF)
val DarkWarning = Color(0xFFFF4800)

internal val LightColorScheme = lightColorScheme(
    primary = LightPrimary,
    onPrimary = Color.White,
    background = LightBackground,
    onBackground = LightText,
    surface = LightSurface,
    onSurface = LightText,
    surfaceVariant = LightSurfaceElevated,
    onSurfaceVariant = LightMuted,
    outline = LightBorder,
    error = LightWarning,
    onError = Color.White,
)

internal val DarkColorScheme = darkColorScheme(
    primary = DarkPrimary,
    onPrimary = Color.White,
    background = DarkBackground,
    onBackground = DarkText,
    surface = DarkSurface,
    onSurface = DarkText,
    surfaceVariant = DarkSurfaceElevated,
    onSurfaceVariant = DarkMuted,
    outline = DarkBorder,
    error = DarkWarning,
    onError = Color.White,
)
