---
title: Duplicate Detection
description: Find and merge duplicate contacts.
sidebar:
  order: 13
---

Over time, especially after imports, it's easy to end up with the same person entered twice. Nametag helps you find and clean those up.

## Finding duplicates across your whole network

From the People page, click **Find Duplicates** to scan all your contacts for pairs that look like the same person, based on similarities in their names and details such as email, phone, and birthday.

Each pair is shown with a similarity score as a percentage badge, so you can quickly judge how likely it is that two entries refer to the same person.

## Per-person duplicates

You don't have to run a full scan to catch a duplicate. On any person's detail page, Nametag also surfaces potential duplicates for that specific contact, so you can deal with them one at a time as you notice them.

## Dismissing false positives

Not every similar pair is actually a duplicate. If a pair is flagged but you know they're two different people, click **Dismiss**. Dismissed pairs won't be suggested again.

## Merging two contacts

When a pair really is the same person, click **Merge** to open a side-by-side comparison. For each field, you choose whether to keep the value from person A or person B.

Merging combines everything into the surviving contact:

- All relationships
- Group memberships
- Journal entries
- Custom field values
- Contact details (phones, emails, addresses, and more)

The other contact is deleted once the merge completes.

## Orphan detection

Merging and general cleanup can sometimes leave contacts stranded: people with no relationships and no group memberships. Nametag can find these orphaned contacts for you, either for a single person or in bulk across your whole network, so you can decide whether to connect them to your network or remove them.

## Algorithm details

Nametag scores potential duplicate pairs using Levenshtein edit-distance combined with composite signal scoring across several fields.

| Signal | Weight |
| --- | --- |
| Name | 40% |
| Email | 30% |
| Phone | 20% |
| Birthday | 10% |

The name signal itself is broken down further: first name contributes a weight of 0.6 to the name score, surname contributes 0.4.

Other rules that affect the final score:

- **Similarity threshold**: pairs scoring below 75% are not flagged as duplicates
- **Sparsity cap**: if fewer than 2 signals are available for comparison, the score is capped at 60%
- **Auto-flag on email match**: a matching email boosts the score to at least 85%
- **Name-only bypass**: if name similarity exceeds 95%, the pair is flagged regardless of how the other signals score

When more than two contacts turn out to be related, Nametag groups them with a Union-Find (disjoint-set) clustering algorithm, so a chain of similar entries is presented as a single cluster instead of overlapping pairs.
