package com.nametag.one.core.network

import com.nametag.one.core.domain.Preferences
import com.russhwolf.settings.Settings

class PreferencesDataSource : Preferences {
    private val settings: Settings = Settings()

    override fun save(key: String, value: String) = settings.putString(key, value)
    override fun get(key: String): String? = settings.getStringOrNull(key)
    override fun remove(key: String) = settings.remove(key)
}
