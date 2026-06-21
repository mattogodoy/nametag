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
