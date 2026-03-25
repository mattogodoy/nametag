# KMP Mobile App — Scaffolding Design

## Overview

A Kotlin Multiplatform (KMP) + Compose Multiplatform mobile app for nametag, living in the `client/` directory. The first commit delivers production-ready splash and login screens with the full project scaffolding — module structure, theme, DI, navigation, and platform integration for both Android and iOS.

Package name: `com.nametag.one`

## Architecture

Follows the teleball mobile app's architecture: Unidirectional Data Flow (UDF) with State/Action/ViewModel pattern, Koin for dependency injection, Jetpack Navigation Compose for routing, and expect/actual for platform-specific code.

### Module Structure

Feature-based modules, with only the modules needed for the first commit (no empty shells):

```
client/
├── app/                          # :app — Android/iOS entry points, root nav
│   ├── src/
│   │   ├── androidMain/          # MainActivity, NametageApplication
│   │   ├── iosMain/              # MainViewController
│   │   └── commonMain/           # App.kt, top-level NavHost, KoinInitializer
│   └── build.gradle.kts
├── core/
│   ├── network/                  # :core:network — Ktor client setup
│   │   ├── src/commonMain/
│   │   └── build.gradle.kts
│   ├── domain/                   # :core:domain — Base models, Result wrapper
│   │   ├── src/commonMain/
│   │   └── build.gradle.kts
│   └── ui/                       # :core:ui — Theme, design system, shared composables
│       ├── src/
│       │   └── commonMain/
│       │       └── kotlin/com/nametag/one/core/ui/
│       │           ├── theme/
│       │           │   ├── NametagTheme.kt
│       │           │   ├── Color.kt
│       │           │   ├── Typography.kt
│       │           │   ├── Shape.kt
│       │           │   └── Spacing.kt
│       │           └── components/
│       │               ├── NametagButton.kt
│       │               ├── NametagTextField.kt
│       │               ├── NametagLogo.kt
│       │               ├── LoadingIndicator.kt
│       │               └── OAuthButton.kt
│       └── build.gradle.kts
├── feature/
│   └── auth/                     # :feature:auth — Splash, Login
│       ├── src/
│       │   └── commonMain/
│       │       └── kotlin/com/nametag/one/feature/auth/
│       │           ├── splash/
│       │           │   ├── SplashScreen.kt
│       │           │   └── SplashViewModel.kt
│       │           └── login/
│       │               ├── LoginScreen.kt
│       │               ├── LoginViewModel.kt
│       │               └── LoginUDF.kt
│       └── build.gradle.kts
├── build.gradle.kts              # Root build config
├── settings.gradle.kts           # Module includes
├── gradle.properties
├── iosApp/                       # Xcode project
│   ├── iosApp/
│   │   ├── iOSApp.swift
│   │   ├── ContentView.swift
│   │   └── AppDelegate.swift
│   └── iosApp.xcodeproj/
└── gradle/
    └── libs.versions.toml
```

### Module Dependencies

```
:app → :feature:auth, :core:ui, :core:network, :core:domain
:feature:auth → :core:ui, :core:domain, :core:network
:core:network → :core:domain
:core:ui → (standalone, Material3 only)
:core:domain → (standalone, pure Kotlin)
```

## Screens

### Splash Screen

- Centered nametag logo: red "HELLO MY NAME IS" badge with white name field
- Name in white field cycles through a diverse list of names with fade-in/out animation using **Permanent Marker** font (bundled .ttf, Apache 2.0 license)
- Name list: Dmitri, Sarah, Kenji, Amara, Luca, Fatima, Maya, Carlos, Yuki, Priya (and more)
- "nametag" text below the logo
- Loading spinner (circular, brand-colored)
- Auto-navigates to Login after ~1.5s
- Animation: `AnimatedContent` with fade transition, `LaunchedEffect` cycling names every ~2.5s

### Login Screen

- Smaller version of the nametag logo at top, same rotating name animation
- "Welcome back" heading + "Sign in to your account" subtitle
- Email text field
- Password text field
- "Sign in" primary button (brand blue)
- "Forgot password?" link
- Divider: "or continue with"
- OAuth buttons row: Google, GitHub (side by side, outlined style)
- "Don't have an account? Sign up" link
- Subtle footer: "Self-hosted? Connect to your server" — very low visual prominence, for advanced users only
- All buttons/links are **UI only** in first commit — no actual API calls

## Theme & Design System

### Color Palette (matching nametag.one web)

**Light mode:**
- Primary: `#1E63FF`
- Background: `#F6F7F9`
- Surface: `#FFFFFF`
- Surface Elevated: `#FAFBFC`
- Text: `#1B1D21`
- Muted: `rgba(27, 29, 33, 0.6)`
- Border: `rgba(30, 99, 255, 0.15)`
- Warning: `#FF4800`

**Dark mode:**
- Primary: `#5C82FF`
- Background: `#0B0C10`
- Surface: `#15171D`
- Surface Elevated: `#1D1F26`
- Text: `#E7EAF0`
- Muted: `rgba(231, 234, 240, 0.65)`
- Border: `rgba(92, 130, 255, 0.2)`
- Warning: `#FF4800`

**Logo red:** `#FF2600` (used in both modes)

### Theme follows system via `isSystemInDarkTheme()`

### Typography

- System font stack for body text (matching web: -apple-system/Roboto)
- **Permanent Marker** font for the rotating name in the logo
- Material3 type scale with proper sizing

### Production Composables (`:core:ui`)

- `NametagTheme` — wraps Material3 `MaterialTheme` with light/dark color schemes
- `Color.kt` — brand color constants
- `Typography.kt` — type scale definition
- `Shape.kt` — rounded corner tokens
- `Spacing.kt` — custom `CompositionLocal` for padding/margin consistency
- `NametagButton` — primary, secondary, text variants with proper states
- `NametagTextField` — styled input with label, placeholder, error state
- `NametagLogo` — the "HELLO MY NAME IS" badge composable with rotating name animation
- `LoadingIndicator` — branded circular spinner
- `OAuthButton` — outlined button for OAuth providers

## Navigation

Single `NavHost` in `:app` with Jetpack Navigation Compose:

- Routes: `Splash`, `Login`
- Start destination: `Splash`
- Splash → Login (forward-only, no back)
- No bottom navigation in first commit

## Dependency Injection (Koin)

### Modules

- `coreModule` — `Preferences` (multiplatform-settings singleton), Ktor `HttpClient`
- `authModule` — `SplashViewModel`, `LoginViewModel` via `viewModelOf`

### Initialization

- **Android:** `NametagApplication.onCreate()` calls `initKoin { androidLogger(); androidContext(this) }`
- **iOS:** `AppDelegate` calls `KoinInitializerKt.doInitKoin(appDeclaration: { _ in })`

## Network Layer (`:core:network`)

- Ktor `HttpClient` with JSON content negotiation (kotlinx.serialization)
- Platform engines: OkHttp (Android), Darwin (iOS)
- Base URL defaults to `https://nametag.one` (configurable via Preferences for self-hosted)
- Logging interceptor for debug builds
- No API calls in first commit — client is configured but unused

## Data Persistence

- `multiplatform-settings` for key-value storage
- `Preferences` interface in `:core:domain`, implementation in `:core:network`
- Stores: server instance URL (defaults to `nametag.one`)

## Platform Integration

### Android

- `NametagApplication` (Application class): Koin init
- `MainActivity`: launches `App()` composable, translucent status bar
- `minSdk` 28, `targetSdk` 35, `compileSdk` 36
- Permissions: INTERNET

### iOS

- SwiftUI shell: `iOSApp.swift` → `ContentView.swift` → `ComposeView` (UIViewControllerRepresentable)
- `AppDelegate.swift`: Koin init
- Deployment target: 17.6

## Build Configuration

### Version Catalog (`gradle/libs.versions.toml`)

| Dependency | Version |
|---|---|
| Kotlin | 2.3.0 |
| Compose Multiplatform | 1.9.3 |
| AGP | 9.0.0 |
| Ktor | 3.3.3 |
| Koin | 4.1.0 |
| KotlinX Serialization | 1.9.0 |
| Navigation Compose | 2.9.1 |
| Multiplatform Settings | 1.3.0 |
| Lifecycle/ViewModel | 2.9.6 |

### Gradle Modules in `settings.gradle.kts`

```kotlin
include(":app")
include(":core:network")
include(":core:domain")
include(":core:ui")
include(":feature:auth")
```

## What's Functional vs Placeholder

**Functional in first commit:**
- Splash screen with logo, rotating name animation, loading spinner, auto-navigation
- Login screen with complete UI layout (both light and dark mode)
- Theme system with light/dark mode following system preference
- Navigation from splash to login
- Koin DI wiring
- Ktor client configured (but no API calls)
- Builds and runs on both Android and iOS

**Placeholder (UI only, no behavior):**
- Sign in button (shows but doesn't authenticate)
- OAuth buttons (Google, GitHub)
- Forgot password link
- Sign up link
- Self-hosted server connection link
