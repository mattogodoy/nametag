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
            LoginAction.SignInClicked -> Unit
            LoginAction.ForgotPasswordClicked -> Unit
            LoginAction.SignUpClicked -> Unit
            LoginAction.GoogleClicked -> Unit
            LoginAction.GitHubClicked -> Unit
            LoginAction.SelfHostedClicked -> Unit
        }
    }
}
