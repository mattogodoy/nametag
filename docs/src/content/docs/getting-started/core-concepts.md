---
title: Core Concepts
description: Understand the key building blocks of Nametag.
---

Nametag is built from a small set of ideas that combine to form your network. Understanding them up front makes the rest of the app, and these docs, much easier to follow.

## People

A person is the core entity in Nametag. The only required field is a full name. Everything else is optional, so you can start with almost nothing and add detail over time as it becomes relevant.

Names are flexible enough to handle real-world naming conventions: first name, surname, middle name, a second last name (for Spanish naming customs), prefix and suffix (Dr., Jr.), a nickname, and an override for how the name is displayed.

Beyond names, a person can have:

- Work info (organization, job title)
- Multi-value contact fields: phone numbers, emails, addresses, URLs, and IM handles, each with its own type (home, work, mobile, and so on)
- Important dates (birthdays, anniversaries, and anything else worth tracking)
- Notes, written in markdown
- Custom fields, for whatever your own workflow needs
- A photo

See [People](/features/people/) for the full picture.

## Groups

Groups are your own categories for organizing people: family, friends, work, school, or anything else that makes sense for how you think about your network. Each group has a name and a color, and a person can belong to as many groups as you like.

Groups aren't just labels. They're used for filtering throughout the app, in the people list, in the network graph, and anywhere else you want to narrow the view down to a specific slice of your life. See [Groups](/features/groups/) for more.

## Relationships

Relationships in Nametag work at two levels:

1. **Your relationship to a person**, which describes how you know them ("this is my cousin", "this is my manager").
2. **Person-to-person relationships**, which describe how people in your network relate to each other independent of you ("Alice is Bob's sibling").

Relationship types are customizable, and Nametag handles the inverse automatically: if you mark someone as a parent of another person, the other person is automatically shown as their child. You're not stuck with a fixed list either, you can define your own relationship types to fit your own family or community structure. See [Relationships](/features/relationships/) for details.

## Network Graph

The network graph is an interactive, D3.js-powered visualization of your personal network. It comes in two views:

- **Dashboard graph**: you at the center, with your entire network radiating outward.
- **Person detail graph**: a selected person at the center, showing their own connections.

Each view supports two display modes: **individuals**, where every person is their own node, and **bubbles**, where people are grouped together by group. See [Network Graph](/features/network-graph/) for more on filtering and interactions.

## Journal

The Journal is a timeline of notes linked to the people you spend time with. Entries support markdown, can be linked to one or more people, and can be filtered by person or searched by text. It's the place to capture the "what happened" that a contact record alone doesn't hold. See [Journal](/features/journal/).

## Map

Addresses you add to a person are geocoded automatically in the background, then plotted as markers on the Map. It's a way to see your network spatially rather than as a list, and you can filter the map by group, city, region, or country. See [Map](/features/map/).

## Important Dates & Reminders

Important dates track birthdays, anniversaries, and any custom date worth remembering for a person. Each one can have an email reminder attached, with a configurable interval (days, weeks, months, or years ahead) so you're never caught off guard. See [Important Dates](/features/important-dates/) and [Contact Reminders](/features/contact-reminders/) for the details.

## Putting it together

A typical person in Nametag has a name, belongs to one or more groups, is connected to other people through relationships, shows up in your network graph, and accumulates journal entries and important dates over time. None of these pieces are required beyond the name itself, so your network can be as light or as detailed as you want it to be.
