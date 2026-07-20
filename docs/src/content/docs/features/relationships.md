---
title: Relationships
description: Map connections between people in your network.
sidebar:
  order: 3
---

Relationships are what turn a list of people into a network. Nametag tracks connections at two levels: how you relate to each person, and how the people in your network relate to each other.

## Two levels of relationships

**Your relationship to a person** describes how you know them: "this person is my cousin", "this person is my colleague". It's set on the person's detail or edit page and answers the question "how do I know this person?"

**Person-to-person relationships** describe how two contacts relate to each other, independent of you: "Alice is Bob's sibling", "Bob is Alice's manager". These are set from a person's detail page, by connecting them to another person in your network.

Both levels use the same set of relationship types, but they're tracked separately, since your connection to someone doesn't have to match how the people around you are connected to one another.

## Relationship types

Nametag comes with a set of built-in relationship types: Parent, Child, Sibling, Spouse, Partner, Friend, Colleague, Acquaintance, Relative, and Other. You're not limited to these. You can create your own types to fit your family structure, your community, or however you naturally describe the people around you.

### Creating custom relationship types

Go to the Relationship Types page to manage them. Each type has:

- **Name**: an internal identifier
- **Label**: the display text shown throughout the app
- **Color**: a hex color used for the type's badge
- **Inverse type** (optional): the relationship type that should be applied automatically in the other direction

## Automatic inverse relationships

When a relationship type has an inverse configured, Nametag applies it automatically. If you set Alice as the parent of Bob, Bob is automatically shown as the child of Alice, you don't need to add both directions by hand. Symmetric types, like Sibling or Friend, use themselves as their own inverse.

## Viewing relationships

On a person's detail page, you'll see both their relationship to you (if any) and the full list of their connections to other people in your network, each shown with its relationship type.

## Managing relationship types

From the Relationship Types page you can create, edit, and soft-delete types. Each type displays a usage count, how many relationships (both person-to-person and to you) currently use it, so you can see the impact before removing one. Soft-deleted types can be restored; see [Trash & Restore](/features/trash/) for details.

## Relationships in the network graph

Every relationship, whether it's your connection to someone or a connection between two other people, appears as an edge in the [network graph](/features/network-graph/), colored by relationship type. This is what turns your list of contacts into a visual map of how everyone connects.
