---
title: Conditional Relationship Labels
description: Make a relationship type display a different word depending on who it names.
sidebar:
  order: 3.5
---

A relationship type normally shows the same label to everyone: "Sibling" for every sibling link, whatever the two people look like. Conditional labels let a type pick a different word based on data already stored on the two people involved, so a sibling link can read "Frère" or "Soeur" and a spouse link can become "Veuf" once the other spouse has died.

## The siblings example

Say you want the Sibling type to display "Frère" or "Soeur" instead of a generic word. Conditions can't read the CardDAV gender column directly, since nothing in the person form lets you set it, so first create a custom field named "Genre" with type "Select" and the options "Homme" and "Femme", and set it on the people it applies to.

On the Relationship Types page, open the type and expand the "Conditional labels" section. You build an ordered list of variants, each one a label plus the conditions that must all be true for it to apply:

1. Described person, Genre, is, Homme, gives "Frère"
2. Described person, Genre, is, Femme, gives "Soeur"
3. Fallback gives "Fratrie"

The first person in each condition, the "described person", is the one the label names, not the person whose page you're looking at. On Alice's detail page, a link to Bob is labelled from Bob's point of view, so Bob is the described person there. Variants are checked in order, top to bottom, and the first one whose conditions all match wins. If none of them match, the fallback applies.

Rather than adding these two variants by hand, use the generator. It creates one variant per possible value of a select custom field, already filled in with the value's name, so you only have to type the labels. It's the fastest way to get to "Frère" and "Soeur".

## The spouse example

Some vocabularies need more than one condition per variant, and the order between variants matters. Take a symmetric Spouse type meant to read "Époux", "Épouse", "Veuf", "Veuve", "Fiancé" or "Conjoint" depending on the two people:

Using the same "Genre" custom field as above:

1. Other person's memorial date is before now, and described person's Genre is Homme, gives "Veuf"
2. Same, with Genre Femme, gives "Veuve"
3. Described person's anniversary date is not set, gives "Fiancé"
4. Described person's anniversary date is after now, gives "Fiancé"
5. Described person's Genre is Homme, gives "Époux"
6. Described person's Genre is Femme, gives "Épouse"
7. Fallback gives "Conjoint"

Variants 3 and 4 show how to express an "or": two variants that produce the same label cover both cases, since a single variant only combines its conditions with "and".

The order is what makes the widowed case reachable at all. "Veuf" has to be tested before "Époux", because a widower would also satisfy "Genre is Homme": if the "Époux" variant came first, it would always win and "Veuf" would never be reached. Variants closer to the top of the list take priority, so put your most specific conditions first and your broadest ones last.

## Fallback and the type with no variants

The last row in the editor is always the fallback: the label used when nothing else matches. It can't be deleted. If you never add any variants at all, the type behaves exactly as it always has: the label you set on the type itself is shown everywhere, at no extra cost.

## Missing data and negative conditions

This is the rule most worth remembering: a condition on data that isn't there is false, and that includes conditions phrased in the negative.

"Nickname is not Coco" does not match a person with no nickname recorded. It only matches someone whose nickname is recorded as something other than Coco. The same goes for "does not contain", "not the same day", and every other negative operator: they need something to compare against, so a person with nothing stored fails them just as they'd fail the positive form.

If what you actually want is "no value has been recorded", use "is not set". That's the only operator built to match absence.

Group membership is the one exception. Belonging to a group is a plain yes or no with no missing state, so "does not belong to" is true for anyone outside the group, including someone you've never touched.

## Dates use the stored date, not the yearly occurrence

A date condition compares the date itself, not this year's anniversary of it. "The wedding date is before today" means the wedding already took place, not that this year's wedding anniversary has passed. This is why the widowed example above works with a plain "before now" on the memorial date, rather than anything tied to the calendar year.

For convenience, the editor offers "is past" and "is future" shortcuts on date fields. They fill in the comparison and today's date for you, and you can still switch to the inclusive form or compare against another date afterward.

## Previewing a rule before saving

While editing a type's variants, pick two people from your network in the preview panel to see the label your rules would produce for them, along with which variant matched or that the fallback applied. The preview runs against the configuration you're editing, before you save it, so you can check tricky cases like the widowed variant without committing anything.

## Technical details

- A relationship type holds at most 20 variants, and each variant holds at most 5 conditions.
- Conditions can read: native person fields (prefix, suffix, nickname, name, surname, middle name, second last name, organization, job title), any custom field you've defined, membership in any of your groups, and important dates, either one of the four predefined types or a custom date matched by its exact title. Gender isn't in that list: it can only be set through CardDAV sync or the API, so there's nothing to condition on from the person form. Define a custom field instead, as in the siblings example above.
- A condition can also compare a value against the same kind of value on the other person, which is what makes age-ordered vocabularies (older sibling versus younger sibling) possible.
- Where the described person has several important dates with the same title, the earliest one is used.
- If a condition points at a group or custom field you've since deleted, it evaluates to false and the editor flags it as broken, so you can fix or remove it.
- Conditional labels only apply where a relationship names a specific other person: the person detail page, the graphs, and trash. Type pickers and autocomplete fields keep showing the type's plain label, since there's no described person to resolve against there.
- A data export keeps the relationship type's own label, not a resolved word. A resolved word depends on the date it was resolved on, and an export is a portable data dump rather than a display, so freezing "Veuf" into a file would freeze a moment in time into something meant to travel. What the export does carry is your variant rules themselves, as configuration: importing them back resolves labels again wherever they're displayed, nothing is lost.
