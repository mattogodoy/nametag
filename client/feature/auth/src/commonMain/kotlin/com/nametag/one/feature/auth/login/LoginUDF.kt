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
