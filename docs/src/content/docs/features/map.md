---
title: Map
description: See your contacts on a map with geocoded addresses.
sidebar:
  order: 6
---

The Map tab shows where your contacts are, plotted on an interactive world map from the addresses and locations you've already added to their records.

## How it works

When you add an address to a contact, Nametag geocodes it in the background, converting the street address into latitude and longitude using a Nominatim-compatible geocoding service. Once geocoding succeeds, the address appears as a marker on the Map tab. You don't need to do anything beyond entering the address.

## The map interface

The map itself is built on MapLibre GL, giving you smooth zooming, panning, and clustering of nearby markers. Contacts with a photo appear as a small circular photo thumbnail, ringed in the color of the first group they belong to; contacts without a photo show as a plain colored dot in that same group color, falling back to the default marker color when they aren't in a colored group. Click a marker (or a cluster) to see who it belongs to and the full address it represents, with a link to their contact page and a link to get directions.

## Filtering

A filter bar above the map lets you narrow down what's shown:

- **Text search**: matches against contact names
- **Group**: show only people in a specific group
- **City**, **region/state**, and **country**: narrow down by location. Since combining these three rarely makes sense together, picking one clears the other two, but you can still combine any one of them with the text search and group filters

## URL-based state and sharing

Every filter you set is encoded in the page URL, so a filtered view of the map is bookmarkable and shareable. Send someone a link with your filters applied and they'll see the same view.

## Deep linking to a person

Add `?focus=<markerId>` to the map URL (where the marker id looks like `addr_<addressId>` or `loc_<locationId>`) to center the map on that marker and open its popup automatically. This is how the "Show on map" links on a person's detail page jump straight to their spot on the map.

## Auto-zoom

If you arrive at the Map tab with filters already present in the URL, the map automatically zooms and pans to fit all the matching markers, so a shared filtered link shows the right view immediately instead of the default world zoom.

## Opting out

Not everyone wants their contacts' addresses sent to a third-party geocoding service. You can turn this off entirely in **Settings > Map**. When disabled, none of your addresses are geocoded, and any pending or previously geocoded coordinates stop updating.

## For self-hosted instances

Administrators can disable geocoding for every user on an instance by setting `DISABLE_GEOCODING=true`. Geocoding itself runs via a background cron job every 5 minutes, processing up to 50 addresses per batch at a rate of one request per second to stay within the geocoding provider's usage limits. By default this uses the public OSM Nominatim service, but it's configurable via the `GEOCODER_URL` environment variable if you'd rather point it at your own instance or another provider.

See [Map & Geocoding](/self-hosting/map-geocoding/) for the full configuration reference.
