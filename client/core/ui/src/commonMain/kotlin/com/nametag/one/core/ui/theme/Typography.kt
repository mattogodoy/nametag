package com.nametag.one.core.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import org.jetbrains.compose.resources.Font
import nametag_mobile.core.ui.generated.resources.Res
import nametag_mobile.core.ui.generated.resources.permanent_marker_regular

@Composable
fun PermanentMarkerFamily() = FontFamily(
    Font(Res.font.permanent_marker_regular, weight = FontWeight.Normal)
)

@Composable
fun NametagTypography() = Typography()
