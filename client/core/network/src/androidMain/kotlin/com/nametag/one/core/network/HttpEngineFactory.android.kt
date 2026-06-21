package com.nametag.one.core.network

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp

actual fun createHttpClient(): HttpClient = createBaseHttpClient {
    HttpClient(OkHttp)
}
