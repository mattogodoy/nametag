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
