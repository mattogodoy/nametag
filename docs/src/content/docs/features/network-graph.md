---
title: Network Graph
description: Visualize your personal network as an interactive graph.
sidebar:
  order: 4
---

The network graph turns your list of people into a picture: a living map of who connects to whom. It shows up in two places, and it works the same way in both.

## Two contexts

- **Dashboard**: you sit at the center, with your entire network radiating outward. This is the big-picture view of everyone you've added.
- **Person detail page**: the selected person sits at the center instead, showing their direct connections. This is the focused view for understanding one person's place in your network.

## Display modes

Nametag offers two ways to render the graph:

- **Individuals**: every person is their own node, connected by edges that represent relationships. This is the default.
- **Bubbles**: people are clustered into bubbles by group membership, so you see clusters instead of a dense tangle of nodes. People who don't belong to any group are collected into their own "Ungrouped" bubble. Click a bubble to expand it into its individual members, and click it again to collapse it back.

You can switch modes from **Settings > Appearance**, or directly from the controls above the graph.

## Filtering by group

A pill selector above the graph lets you narrow down who's shown, with a few filter modes working together:

- **Any (OR) mode**: shows people who belong to at least one of the selected groups
- **All (AND) mode**: shows only people who belong to every selected group
- **Negation**: click a selected pill again to flip it from included to excluded, hiding people who belong to that group instead of showing them
- **Ungrouped**: a dedicated filter for people who don't belong to any group at all

A help button next to the filters walks through these modes with visual examples if you ever need a refresher.

## Node and edge appearance

- Each node shows the person's photo, or their initials if they haven't uploaded one
- Nodes are colored by group membership
- Edges are colored by relationship type, so you can tell at a glance whether a connection is family, a friendship, or something else

## Interactions

- **Click a node** to navigate to that person's detail page (clicking the center node on the dashboard takes you to your own dashboard)
- **Drag a node** to rearrange it manually. Nametag's force simulation will let it settle back into place once you let go, unless you've pinned it by moving it
- **Scroll to zoom** in and out
- **Drag the background** to pan around
- A **recenter button** resets the zoom and pan back to the default view

There are no dedicated keyboard shortcuts beyond these pointer interactions today.

## Technical details

For the curious: the graph is powered by a D3.js force-directed simulation, rendered to an HTML canvas rather than SVG for performance. A level-of-detail (LOD) system simplifies what gets drawn depending on zoom level, showing simple dots when zoomed far out, adding labels at a middle zoom level, and rendering full detail (photos, names, colors) only once you're zoomed in close enough to read them.

## Performance at scale

Canvas rendering combined with the LOD system means the graph stays responsive even for large networks. If you're tracking 100 or more people, expect the same smooth panning and zooming you'd get with a much smaller network, since Nametag only draws full detail for what's actually visible and legible at the current zoom level.

## Limits and constraints

| Item | Value |
| --- | --- |
| Performance warning threshold | 100 nodes |
| Max nodes shown | 500 nodes |
| Default degrees of separation | 2 |
| LOD tier: dots | zoom below 0.6 |
| LOD tier: labels | zoom between 0.6 and 1.2 |
| LOD tier: full detail (with photos) | zoom 1.2 and above |
