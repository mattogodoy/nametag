package com.nametag.one.core.network

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin

actual fun createHttpClient(): HttpClient = createBaseHttpClient {
    HttpClient(Darwin)
}
