# KMP Mobile App Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a buildable KMP + Compose Multiplatform app in `client/` showing a production-ready splash screen and login screen on both Android and iOS.

**Architecture:** Feature-based multi-module KMP project following UDF pattern (State/Action/ViewModel), Koin DI, Jetpack Navigation Compose, and expect/actual for platform code. Modules: `:app`, `:core:domain`, `:core:ui`, `:core:network`, `:feature:auth`.

**Tech Stack:** Kotlin 2.3.0, Compose Multiplatform 1.9.3, AGP 9.0.0, Gradle 9.1.0, Koin 4.1.0, Ktor 3.3.3, Navigation Compose 2.9.1, multiplatform-settings 1.3.0

**Spec:** `docs/superpowers/specs/2026-03-25-kmp-mobile-app-design.md`

**Reference:** `~/DH/teleball/mobile/` (for architecture patterns only — no teleball code/strings/assets in output)

---

### Task 1: Gradle Wrapper, Root Build Files, and .gitignore

**Files:**
- Create: `client/settings.gradle.kts`
- Create: `client/build.gradle.kts`
- Create: `client/gradle.properties`
- Create: `client/gradle/libs.versions.toml`
- Create: `client/gradle/wrapper/gradle-wrapper.properties`
- Modify: `.gitignore`

- [ ] **Step 1: Copy Gradle wrapper from teleball**

```bash
mkdir -p client/gradle/wrapper
cp ~/DH/teleball/mobile/gradlew client/gradlew
cp ~/DH/teleball/mobile/gradlew.bat client/gradlew.bat
cp ~/DH/teleball/mobile/gradle/wrapper/gradle-wrapper.jar client/gradle/wrapper/gradle-wrapper.jar
chmod +x client/gradlew
```

- [ ] **Step 2: Create gradle-wrapper.properties**

Create `client/gradle/wrapper/gradle-wrapper.properties`:
```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-9.1.0-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

- [ ] **Step 3: Create version catalog**

Create `client/gradle/libs.versions.toml`:
```toml
[versions]
agp = "9.0.0"
android-compileSdk = "36"
android-minSdk = "28"
android-targetSdk = "35"
androidx-activityCompose = "1.12.2"
androidx-lifecycle = "2.9.6"
compose-multiplatform = "1.9.3"
kotlin = "2.3.0"
ktor = "3.3.3"
coroutines = "1.10.2"
multiplatformSettings = "1.3.0"
navigationCompose = "2.9.1"
serialization = "1.9.0"
koin = "4.1.0"

[libraries]
kotlin-test = { module = "org.jetbrains.kotlin:kotlin-test", version.ref = "kotlin" }
kotlinx-coroutines-test = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-test", version.ref = "coroutines" }
androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activityCompose" }
androidx-lifecycle-viewmodel = { group = "org.jetbrains.androidx.lifecycle", name = "lifecycle-viewmodel", version.ref = "androidx-lifecycle" }
androidx-lifecycle-viewmodel-compose = { group = "org.jetbrains.androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "androidx-lifecycle" }
androidx-lifecycle-runtime-compose = { group = "org.jetbrains.androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "androidx-lifecycle" }
ktor-client-content-negotiation = { module = "io.ktor:ktor-client-content-negotiation", version.ref = "ktor" }
ktor-serialization-kotlinx-json = { module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-okhttp = { module = "io.ktor:ktor-client-okhttp", version.ref = "ktor" }
ktor-client-darwin = { module = "io.ktor:ktor-client-darwin", version.ref = "ktor" }
ktor-client-logging = { module = "io.ktor:ktor-client-logging", version.ref = "ktor" }
kotlinx-coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }
kotlinx-serialization-core = { module = "org.jetbrains.kotlinx:kotlinx-serialization-core", version.ref = "serialization" }
kotlinx-serialization-json = { module = "org.jetbrains.kotlinx:kotlinx-serialization-json", version.ref = "serialization" }
multiplatform-settings = { module = "com.russhwolf:multiplatform-settings-no-arg", version.ref = "multiplatformSettings" }
navigation-compose = { module = "org.jetbrains.androidx.navigation:navigation-compose", version.ref = "navigationCompose" }
koin-core = { module = "io.insert-koin:koin-core", version.ref = "koin" }
koin-android = { module = "io.insert-koin:koin-android", version.ref = "koin" }
koin-compose = { module = "io.insert-koin:koin-compose", version.ref = "koin" }
koin-compose-viewmodel = { module = "io.insert-koin:koin-compose-viewmodel", version.ref = "koin" }

[plugins]
androidApplication = { id = "com.android.application", version.ref = "agp" }
androidLibrary = { id = "com.android.library", version.ref = "agp" }
composeMultiplatform = { id = "org.jetbrains.compose", version.ref = "compose-multiplatform" }
composeCompiler = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlinMultiplatform = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
```

- [ ] **Step 4: Create root build.gradle.kts**

Create `client/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.androidLibrary) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.serialization) apply false
}
```

- [ ] **Step 5: Create settings.gradle.kts**

Create `client/settings.gradle.kts`:
```kotlin
rootProject.name = "nametag-mobile"
enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

pluginManagement {
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
    }
}

include(":app")
include(":core:network")
include(":core:domain")
include(":core:ui")
include(":feature:auth")
```

- [ ] **Step 6: Create gradle.properties**

Create `client/gradle.properties`:
```properties
kotlin.code.style=official
kotlin.daemon.jvmargs=-Xmx2048M
org.gradle.jvmargs=-Xmx4g -Dfile.encoding=UTF-8
kotlin.experimental.expect.actual.classes=true
android.nonTransitiveRClass=true
android.useAndroidX=true
```

- [ ] **Step 7: Update .gitignore**

Append to the root `.gitignore`:
```
# KMP Mobile Client
client/.gradle/
client/build/
client/*/build/
client/*/*/build/
client/iosApp/*.xcworkspace/xcuserdata/
client/iosApp/iosApp.xcodeproj/xcuserdata/
client/local.properties
```

- [ ] **Step 8: Commit**

```bash
git add client/gradlew client/gradlew.bat client/gradle/ client/build.gradle.kts client/settings.gradle.kts client/gradle.properties .gitignore
git commit -m "feat(client): add KMP project root with Gradle wrapper and build config"
```

---

### Task 2: `:core:domain` Module

**Files:**
- Create: `client/core/domain/build.gradle.kts`
- Create: `client/core/domain/src/commonMain/kotlin/com/nametag/one/core/domain/Preferences.kt`

- [ ] **Step 1: Create build.gradle.kts**

Create `client/core/domain/build.gradle.kts`:
```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    iosX64()
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain.dependencies {
            implementation(libs.kotlinx.coroutines.core)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

android {
    namespace = "com.nametag.one.core.domain"
    compileSdk = libs.versions.android.compileSdk.get().toInt()
    defaultConfig {
        minSdk = libs.versions.android.minSdk.get().toInt()
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
```

- [ ] **Step 2: Create Preferences interface**

Create `client/core/domain/src/commonMain/kotlin/com/nametag/one/core/domain/Preferences.kt`:
```kotlin
package com.nametag.one.core.domain

interface Preferences {
    fun save(key: String, value: String)
    fun get(key: String): String?
    fun remove(key: String)

    companion object {
        const val SERVER_URL_KEY = "SERVER_URL"
        const val DEFAULT_SERVER_URL = "https://nametag.one"
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add client/core/domain/
git commit -m "feat(client): add :core:domain module with Preferences interface"
```

---

### Task 3: `:core:ui` Module — Theme and Design System

**Files:**
- Create: `client/core/ui/build.gradle.kts`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Color.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Typography.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Shape.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Spacing.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/NametagTheme.kt`
- Create: `client/core/ui/src/commonMain/composeResources/font/permanent_marker_regular.ttf`

- [ ] **Step 1: Create build.gradle.kts**

Create `client/core/ui/build.gradle.kts`:
```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    iosX64()
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
        }
    }
}

android {
    namespace = "com.nametag.one.core.ui"
    compileSdk = libs.versions.android.compileSdk.get().toInt()
    defaultConfig {
        minSdk = libs.versions.android.minSdk.get().toInt()
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
```

- [ ] **Step 2: Download Permanent Marker font**

```bash
mkdir -p client/core/ui/src/commonMain/composeResources/font
curl -L -o client/core/ui/src/commonMain/composeResources/font/permanent_marker_regular.ttf \
  "https://github.com/google/fonts/raw/main/apache/permanentmarker/PermanentMarker-Regular.ttf"
```

Verify the file is not empty:
```bash
ls -la client/core/ui/src/commonMain/composeResources/font/permanent_marker_regular.ttf
```
Expected: file size > 50KB

- [ ] **Step 3: Create Color.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Color.kt`:
```kotlin
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
```

- [ ] **Step 4: Create Spacing.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Spacing.kt`:
```kotlin
package com.nametag.one.core.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class Spacing(
    val tiny: Dp = 4.dp,
    val small: Dp = 8.dp,
    val medium: Dp = 16.dp,
    val large: Dp = 24.dp,
    val extraLarge: Dp = 32.dp,
)

val LocalSpacing = staticCompositionLocalOf { Spacing() }
```

- [ ] **Step 5: Create Shape.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Shape.kt`:
```kotlin
package com.nametag.one.core.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

val NametagShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
)
```

- [ ] **Step 6: Create Typography.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/Typography.kt`:
```kotlin
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
```

Note: We use the default Material3 typography (system fonts) for body text. `PermanentMarkerFamily()` is used only by the `NametagLogo` composable for the rotating name.

- [ ] **Step 7: Create NametagTheme.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/theme/NametagTheme.kt`:
```kotlin
package com.nametag.one.core.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

@Composable
fun NametagTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(
        LocalSpacing provides Spacing(),
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = NametagTypography(),
            shapes = NametagShapes,
            content = content,
        )
    }
}
```

- [ ] **Step 8: Commit**

```bash
git add client/core/ui/
git commit -m "feat(client): add :core:ui module with theme, colors, typography, and Permanent Marker font"
```

---

### Task 4: `:core:ui` Module — Production Composables

**Files:**
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/NametagButton.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/NametagTextField.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/NametagLogo.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/LoadingIndicator.kt`
- Create: `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/OAuthButton.kt`

- [ ] **Step 1: Create NametagButton.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/NametagButton.kt`:
```kotlin
package com.nametag.one.core.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun NametagButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp),
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

@Composable
fun NametagTextButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TextButton(
        onClick = onClick,
        modifier = modifier,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}
```

- [ ] **Step 2: Create NametagTextField.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/NametagTextField.kt`:
```kotlin
package com.nametag.one.core.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun NametagTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    visualTransformation: VisualTransformation = VisualTransformation.None,
    isError: Boolean = false,
    errorMessage: String? = null,
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = {
                Text(
                    text = placeholder,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            visualTransformation = visualTransformation,
            isError = isError,
            shape = MaterialTheme.shapes.medium,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            ),
            singleLine = true,
        )
        if (isError && errorMessage != null) {
            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
```

- [ ] **Step 3: Create NametagLogo.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/NametagLogo.kt`:
```kotlin
package com.nametag.one.core.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.unit.Dp
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
        // "HELLO" + "MY NAME IS"
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
        // White name field
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
```

- [ ] **Step 4: Create LoadingIndicator.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/LoadingIndicator.kt`:
```kotlin
package com.nametag.one.core.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun LoadingIndicator(
    modifier: Modifier = Modifier,
) {
    CircularProgressIndicator(
        modifier = modifier.size(32.dp),
        color = MaterialTheme.colorScheme.primary,
        strokeWidth = 3.dp,
    )
}
```

- [ ] **Step 5: Create OAuthButton.kt**

Create `client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/OAuthButton.kt`:
```kotlin
package com.nametag.one.core.ui.components

import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun OAuthButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(44.dp),
        shape = MaterialTheme.shapes.medium,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add client/core/ui/src/commonMain/kotlin/com/nametag/one/core/ui/components/
git commit -m "feat(client): add production UI components — button, text field, logo, loading, OAuth"
```

---

### Task 5: `:core:network` Module

**Files:**
- Create: `client/core/network/build.gradle.kts`
- Create: `client/core/network/src/commonMain/kotlin/com/nametag/one/core/network/HttpClientFactory.kt`
- Create: `client/core/network/src/commonMain/kotlin/com/nametag/one/core/network/PreferencesDataSource.kt`
- Create: `client/core/network/src/commonMain/kotlin/com/nametag/one/core/network/di/NetworkModule.kt`
- Create: `client/core/network/src/androidMain/kotlin/com/nametag/one/core/network/HttpEngineFactory.android.kt`
- Create: `client/core/network/src/iosMain/kotlin/com/nametag/one/core/network/HttpEngineFactory.ios.kt`

- [ ] **Step 1: Create build.gradle.kts**

Create `client/core/network/build.gradle.kts`:
```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.serialization)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    iosX64()
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain.dependencies {
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.logging)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.kotlinx.serialization.core)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.multiplatform.settings)
            implementation(libs.koin.core)
            implementation(project(":core:domain"))
        }
        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}

android {
    namespace = "com.nametag.one.core.network"
    compileSdk = libs.versions.android.compileSdk.get().toInt()
    defaultConfig {
        minSdk = libs.versions.android.minSdk.get().toInt()
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
```

- [ ] **Step 2: Create PreferencesDataSource.kt**

Create `client/core/network/src/commonMain/kotlin/com/nametag/one/core/network/PreferencesDataSource.kt`:
```kotlin
package com.nametag.one.core.network

import com.nametag.one.core.domain.Preferences
import com.russhwolf.settings.Settings

class PreferencesDataSource : Preferences {
    private val settings: Settings = Settings()

    override fun save(key: String, value: String) = settings.putString(key, value)
    override fun get(key: String): String? = settings.getStringOrNull(key)
    override fun remove(key: String) = settings.remove(key)
}
```

- [ ] **Step 3: Create HttpClientFactory.kt**

Create `client/core/network/src/commonMain/kotlin/com/nametag/one/core/network/HttpClientFactory.kt`:
```kotlin
package com.nametag.one.core.network

import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

expect fun createHttpClient(): HttpClient

fun createBaseHttpClient(engineFactory: () -> HttpClient): HttpClient {
    return engineFactory().config {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                prettyPrint = false
            })
        }
        install(Logging) {
            level = LogLevel.BODY
        }
    }
}
```

- [ ] **Step 4: Create platform HTTP engine factories**

Create `client/core/network/src/androidMain/kotlin/com/nametag/one/core/network/HttpEngineFactory.android.kt`:
```kotlin
package com.nametag.one.core.network

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp

actual fun createHttpClient(): HttpClient = createBaseHttpClient {
    HttpClient(OkHttp)
}
```

Create `client/core/network/src/iosMain/kotlin/com/nametag/one/core/network/HttpEngineFactory.ios.kt`:
```kotlin
package com.nametag.one.core.network

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin

actual fun createHttpClient(): HttpClient = createBaseHttpClient {
    HttpClient(Darwin)
}
```

- [ ] **Step 5: Create NetworkModule.kt (Koin)**

Create `client/core/network/src/commonMain/kotlin/com/nametag/one/core/network/di/NetworkModule.kt`:
```kotlin
package com.nametag.one.core.network.di

import com.nametag.one.core.domain.Preferences
import com.nametag.one.core.network.PreferencesDataSource
import com.nametag.one.core.network.createHttpClient
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.bind
import org.koin.dsl.module

val networkModule = module {
    single { createHttpClient() }
    singleOf(::PreferencesDataSource) bind Preferences::class
}
```

- [ ] **Step 6: Commit**

```bash
git add client/core/network/
git commit -m "feat(client): add :core:network module with Ktor client, Preferences impl, and Koin module"
```

---

### Task 6: `:feature:auth` Module — Splash Screen

**Files:**
- Create: `client/feature/auth/build.gradle.kts`
- Create: `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/splash/SplashScreen.kt`

- [ ] **Step 1: Create build.gradle.kts**

Create `client/feature/auth/build.gradle.kts`:
```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    iosX64()
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
            implementation(libs.androidx.lifecycle.viewmodel)
            implementation(libs.androidx.lifecycle.viewmodel.compose)
            implementation(libs.androidx.lifecycle.runtime.compose)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.navigation.compose)
            implementation(libs.koin.core)
            implementation(libs.koin.compose)
            implementation(libs.koin.compose.viewmodel)
            implementation(project(":core:ui"))
            implementation(project(":core:domain"))
            implementation(project(":core:network"))
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.kotlinx.coroutines.test)
        }
    }
}

android {
    namespace = "com.nametag.one.feature.auth"
    compileSdk = libs.versions.android.compileSdk.get().toInt()
    defaultConfig {
        minSdk = libs.versions.android.minSdk.get().toInt()
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
```

- [ ] **Step 2: Create SplashScreen.kt**

Create `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/splash/SplashScreen.kt`:
```kotlin
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
```

- [ ] **Step 3: Commit**

```bash
git add client/feature/auth/
git commit -m "feat(client): add :feature:auth module with splash screen"
```

---

### Task 7: `:feature:auth` Module — Login Screen

**Files:**
- Create: `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/login/LoginUDF.kt`
- Create: `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/login/LoginViewModel.kt`
- Create: `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/login/LoginScreen.kt`

- [ ] **Step 1: Create LoginUDF.kt**

Create `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/login/LoginUDF.kt`:
```kotlin
package com.nametag.one.feature.auth.login

sealed interface LoginState {
    data class Content(
        val email: String = "",
        val password: String = "",
        val isLoading: Boolean = false,
        val errorMessage: String? = null,
    ) : LoginState
}

sealed interface LoginAction {
    data class EmailChanged(val email: String) : LoginAction
    data class PasswordChanged(val password: String) : LoginAction
    data object SignInClicked : LoginAction
    data object ForgotPasswordClicked : LoginAction
    data object SignUpClicked : LoginAction
    data object GoogleClicked : LoginAction
    data object GitHubClicked : LoginAction
    data object SelfHostedClicked : LoginAction
}
```

- [ ] **Step 2: Create LoginViewModel.kt**

Create `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/login/LoginViewModel.kt`:
```kotlin
package com.nametag.one.feature.auth.login

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class LoginViewModel : ViewModel() {
    private val _state = MutableStateFlow<LoginState>(LoginState.Content())
    val state: StateFlow<LoginState> = _state

    fun handle(action: LoginAction) {
        val current = _state.value as? LoginState.Content ?: return
        when (action) {
            is LoginAction.EmailChanged -> _state.value = current.copy(email = action.email)
            is LoginAction.PasswordChanged -> _state.value = current.copy(password = action.password)
            // All other actions are placeholders — no-op for first commit
            LoginAction.SignInClicked -> Unit
            LoginAction.ForgotPasswordClicked -> Unit
            LoginAction.SignUpClicked -> Unit
            LoginAction.GoogleClicked -> Unit
            LoginAction.GitHubClicked -> Unit
            LoginAction.SelfHostedClicked -> Unit
        }
    }
}
```

- [ ] **Step 3: Create LoginScreen.kt**

Create `client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/login/LoginScreen.kt`:
```kotlin
package com.nametag.one.feature.auth.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nametag.one.core.ui.components.LogoSize
import com.nametag.one.core.ui.components.NametagButton
import com.nametag.one.core.ui.components.NametagLogo
import com.nametag.one.core.ui.components.NametagTextButton
import com.nametag.one.core.ui.components.NametagTextField
import com.nametag.one.core.ui.components.OAuthButton
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun LoginScreen(
    viewModel: LoginViewModel = koinViewModel(),
) {
    val state by viewModel.state.collectAsState()
    val content = state as? LoginState.Content ?: return

    LoginContent(
        state = content,
        onAction = viewModel::handle,
    )
}

@Composable
private fun LoginContent(
    state: LoginState.Content,
    onAction: (LoginAction) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.height(60.dp))

        // Logo
        NametagLogo(size = LogoSize.Small)

        Spacer(modifier = Modifier.height(24.dp))

        // Welcome text
        Text(
            text = "Welcome back",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = "Sign in to your account",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Email field
        NametagTextField(
            value = state.email,
            onValueChange = { onAction(LoginAction.EmailChanged(it)) },
            label = "Email",
            placeholder = "you@example.com",
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Password field
        NametagTextField(
            value = state.password,
            onValueChange = { onAction(LoginAction.PasswordChanged(it)) },
            label = "Password",
            placeholder = "••••••••",
            visualTransformation = PasswordVisualTransformation(),
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Sign in button
        NametagButton(
            text = "Sign in",
            onClick = { onAction(LoginAction.SignInClicked) },
        )

        // Forgot password
        NametagTextButton(
            text = "Forgot password?",
            onClick = { onAction(LoginAction.ForgotPasswordClicked) },
            modifier = Modifier.padding(top = 8.dp),
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Divider
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                color = MaterialTheme.colorScheme.outline,
            )
            Text(
                text = "or continue with",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                color = MaterialTheme.colorScheme.outline,
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // OAuth buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OAuthButton(
                text = "Google",
                onClick = { onAction(LoginAction.GoogleClicked) },
                modifier = Modifier.weight(1f),
            )
            OAuthButton(
                text = "GitHub",
                onClick = { onAction(LoginAction.GitHubClicked) },
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Sign up
        Row(
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Don't have an account?",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            NametagTextButton(
                text = "Sign up",
                onClick = { onAction(LoginAction.SignUpClicked) },
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        // Self-hosted (subtle)
        NametagTextButton(
            text = "Self-hosted? Connect to your server",
            onClick = { onAction(LoginAction.SelfHostedClicked) },
            modifier = Modifier.padding(bottom = 24.dp),
        )
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add client/feature/auth/src/commonMain/kotlin/com/nametag/one/feature/auth/login/
git commit -m "feat(client): add login screen with UDF pattern, ViewModel, and production UI"
```

---

### Task 8: `:app` Module — Common Code (Navigation, DI, App Entry Point)

**Files:**
- Create: `client/app/build.gradle.kts`
- Create: `client/app/src/commonMain/kotlin/com/nametag/one/navigation/Routes.kt`
- Create: `client/app/src/commonMain/kotlin/com/nametag/one/di/KoinInitializer.kt`
- Create: `client/app/src/commonMain/kotlin/com/nametag/one/di/Modules.kt`
- Create: `client/app/src/commonMain/kotlin/com/nametag/one/App.kt`

- [ ] **Step 1: Create app/build.gradle.kts**

Create `client/app/build.gradle.kts`:
```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_11)
        }
    }

    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    sourceSets {
        androidMain.dependencies {
            implementation(compose.preview)
            implementation(libs.androidx.activity.compose)
            implementation(libs.koin.android)
        }
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
            implementation(libs.androidx.lifecycle.viewmodel)
            implementation(libs.androidx.lifecycle.viewmodel.compose)
            implementation(libs.androidx.lifecycle.runtime.compose)
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.navigation.compose)
            implementation(libs.koin.core)
            implementation(libs.koin.compose)
            implementation(libs.koin.compose.viewmodel)
            implementation(project(":core:ui"))
            implementation(project(":core:domain"))
            implementation(project(":core:network"))
            implementation(project(":feature:auth"))
        }
    }
}

android {
    namespace = "com.nametag.one"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.nametag.one"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
```

- [ ] **Step 2: Create Routes.kt**

Create `client/app/src/commonMain/kotlin/com/nametag/one/navigation/Routes.kt`:
```kotlin
package com.nametag.one.navigation

enum class Routes {
    Splash,
    Login,
}
```

- [ ] **Step 3: Create Koin modules**

Create `client/app/src/commonMain/kotlin/com/nametag/one/di/Modules.kt`:
```kotlin
package com.nametag.one.di

import com.nametag.one.feature.auth.login.LoginViewModel
import org.koin.core.module.dsl.viewModelOf
import org.koin.dsl.module

val authModule = module {
    viewModelOf(::LoginViewModel)
}
```

Create `client/app/src/commonMain/kotlin/com/nametag/one/di/KoinInitializer.kt`:
```kotlin
package com.nametag.one.di

import com.nametag.one.core.network.di.networkModule
import org.koin.core.context.startKoin
import org.koin.dsl.KoinAppDeclaration

fun initKoin(appDeclaration: KoinAppDeclaration = {}) = startKoin {
    appDeclaration()
    modules(networkModule, authModule)
}
```

- [ ] **Step 4: Create App.kt**

Create `client/app/src/commonMain/kotlin/com/nametag/one/App.kt`:
```kotlin
package com.nametag.one

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
```

- [ ] **Step 5: Commit**

```bash
git add client/app/build.gradle.kts client/app/src/commonMain/
git commit -m "feat(client): add App entry point with navigation, Koin DI setup, and routes"
```

---

### Task 9: `:app` Module — Android Platform Code

**Files:**
- Create: `client/app/src/androidMain/kotlin/com/nametag/one/NametagApplication.kt`
- Create: `client/app/src/androidMain/kotlin/com/nametag/one/MainActivity.kt`
- Create: `client/app/src/androidMain/AndroidManifest.xml`
- Create: `client/app/src/androidMain/res/values/strings.xml`

- [ ] **Step 1: Create NametagApplication.kt**

Create `client/app/src/androidMain/kotlin/com/nametag/one/NametagApplication.kt`:
```kotlin
package com.nametag.one

import android.app.Application
import com.nametag.one.di.initKoin
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger

class NametagApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initKoin {
            androidLogger()
            androidContext(this@NametagApplication)
        }
    }
}
```

- [ ] **Step 2: Create MainActivity.kt**

Create `client/app/src/androidMain/kotlin/com/nametag/one/MainActivity.kt`:
```kotlin
package com.nametag.one

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SetTranslucentStatusBar()
            App()
        }
    }
}

@Composable
private fun SetTranslucentStatusBar() {
    val view = LocalView.current
    val window = (view.context as ComponentActivity).window
    SideEffect {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        WindowInsetsControllerCompat(window, view).isAppearanceLightStatusBars = false
    }
}
```

- [ ] **Step 3: Create AndroidManifest.xml**

Create `client/app/src/androidMain/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:name=".NametagApplication"
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
```

- [ ] **Step 4: Create strings.xml**

Create `client/app/src/androidMain/res/values/strings.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Nametag</string>
</resources>
```

- [ ] **Step 5: Commit**

```bash
git add client/app/src/androidMain/
git commit -m "feat(client): add Android platform code — Application, MainActivity, manifest"
```

---

### Task 10: `:app` Module — iOS Platform Code

**Files:**
- Create: `client/app/src/iosMain/kotlin/com/nametag/one/MainViewController.kt`
- Create: `client/iosApp/iosApp/iOSApp.swift`
- Create: `client/iosApp/iosApp/ContentView.swift`
- Create: `client/iosApp/iosApp/AppDelegate.swift`

- [ ] **Step 1: Create MainViewController.kt**

Create `client/app/src/iosMain/kotlin/com/nametag/one/MainViewController.kt`:
```kotlin
package com.nametag.one

import androidx.compose.ui.window.ComposeUIViewController

fun MainViewController() = ComposeUIViewController { App() }
```

- [ ] **Step 2: Create iOS app files**

Create directory structure:
```bash
mkdir -p client/iosApp/iosApp
```

Create `client/iosApp/iosApp/iOSApp.swift`:
```swift
import SwiftUI

@main
struct iOSApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

Create `client/iosApp/iosApp/ContentView.swift`:
```swift
import UIKit
import SwiftUI
import ComposeApp

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

struct ContentView: View {
    var body: some View {
        ComposeView()
            .ignoresSafeArea(.keyboard)
            .edgesIgnoringSafeArea([.top, .bottom])
    }
}
```

Create `client/iosApp/iosApp/AppDelegate.swift`:
```swift
import UIKit
import ComposeApp

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        KoinInitializerKt.doInitKoin(appDeclaration: { _ in })
        return true
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add client/app/src/iosMain/ client/iosApp/
git commit -m "feat(client): add iOS platform code — MainViewController, SwiftUI shell, AppDelegate"
```

---

### Task 11: Verify Android Build

- [ ] **Step 1: Run Gradle sync and build**

```bash
cd client && ./gradlew :app:assembleDebug
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 2: Fix any compilation errors**

If errors occur, read the output carefully and fix. Common issues:
- Missing imports in generated resource classes (the `Res.font.permanent_marker_regular` reference depends on the Compose resources plugin generating code — the resource path must match exactly)
- Module dependency issues

- [ ] **Step 3: Commit any fixes**

```bash
git add -A client/
git commit -m "fix(client): resolve build issues from initial scaffolding"
```

---

### Task 12: Final Cleanup and Squash Commit

- [ ] **Step 1: Verify the complete file structure**

```bash
find client -type f -name "*.kt" -o -name "*.kts" -o -name "*.swift" -o -name "*.xml" -o -name "*.toml" -o -name "*.properties" | sort
```

Verify all expected files exist per the spec.

- [ ] **Step 2: Ensure no teleball references**

```bash
grep -ri "teleball" client/ || echo "No teleball references found ✓"
grep -ri "nicefox" client/ || echo "No nicefox references found ✓"
grep -ri "dhorowitz" client/ || echo "No dhorowitz references found ✓"
```

Expected: All three checks return "not found ✓"

- [ ] **Step 3: Final commit if any cleanup was needed**

```bash
git add -A client/
git status
# Only commit if there are changes
git commit -m "feat(client): KMP mobile app scaffolding with splash and login screens

Adds a Kotlin Multiplatform + Compose Multiplatform mobile app in client/
with feature-based module architecture:

- :app — Android/iOS entry points, navigation, Koin DI init
- :core:domain — Preferences interface
- :core:ui — Nametag theme (light/dark), design system components
- :core:network — Ktor HTTP client, preferences implementation
- :feature:auth — Splash screen with animated nametag logo, login screen

Screens are production-ready UI with light/dark mode support.
Login buttons are placeholder (UI only, no API calls).
Package: com.nametag.one"
```
