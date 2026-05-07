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
