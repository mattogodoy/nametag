---
title: Installing the App
description: Add Nametag to your phone home screen or desktop.
sidebar:
  order: 18
---

Nametag can be installed as an app. Once installed it gets its own icon, opens in its own window without browser chrome, and appears in your app switcher like any other app. There is nothing to download from an app store.

## iOS and iPadOS

Safari does not offer an automatic install prompt, so this is a manual step:

1. Open Nametag in Safari.
2. Tap the Share button.
3. Scroll down and tap "Add to Home Screen".
4. Tap "Add".

Other iOS browsers such as Chrome and Firefox use Safari's engine but do not all expose "Add to Home Screen". If you cannot find it, use Safari.

## Android

Chrome shows an install prompt on the dashboard the first time you visit. You can also install from the browser menu, or from Settings > Appearance > Install app inside Nametag.

Once installed, long-pressing the icon gives you shortcuts straight to Add person, Search and Dashboard.

## Desktop

Chrome and Edge show an install button in the address bar. Safari on macOS supports "Add to Dock" from the File menu.

## What works offline

Not much, deliberately. Nametag shows a branded offline page instead of a browser error, and previously loaded styles and scripts keep working, so the app starts instantly.

Your actual contact data is **not** cached. Nametag needs a connection to show your people. This is a privacy decision: cached pages are stored unencrypted on the device and would survive signing out, which is not an acceptable trade for an app holding personal details about people who did not choose to use it.

## Uninstalling

Uninstall it like any other app: long-press the icon and remove it on a phone, or use your browser's app management page on desktop. Removing the app does not touch your account or your data.

## Technical details

- Installation requires the site to be served over HTTPS. `localhost` is exempt. Self-hosters serving over plain HTTP will not see an install option at all. See [Reverse Proxy](/self-hosting/reverse-proxy/).
- The install banner appears on the dashboard only, once per browser. Dismissing it hides it permanently. The Settings > Appearance section is always available.
- iOS evicts service worker caches after roughly 7 days without opening the app. The offline page is refetched the next time you open Nametag with a connection.
- The app launches at `/`, which redirects to your dashboard or the login page depending on whether your session is still valid.
