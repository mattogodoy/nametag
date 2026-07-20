---
title: Custom Fields
description: Define custom attributes for your contacts.
sidebar:
  order: 10
---

Custom fields let you track attributes that aren't part of Nametag's built-in fields, whatever matters for how you think about your network: company, department, how you met, a membership number, or anything else specific to you.

## Defining a template

Custom fields start with a template, created in Settings > Custom Fields. Each template has:

- **Name**: what the field is called, shown as the label wherever it appears
- **Slug**: generated automatically from the name, used internally and in filter URLs
- **Type**: the kind of value the field holds

## Field types

Nametag supports four field types:

- **Text**: free-form text
- **Number**: a numeric value
- **Boolean**: a simple yes/no toggle
- **Select**: a dropdown chosen from a list of options you define when creating the template

When you create a Select field, you'll also define the list of allowed options. A field's type can't be changed after creation, since existing values on people already depend on it, but the name and options can still be edited.

## Reordering templates

Use the up and down buttons next to each template in Settings > Custom Fields to reorder them. The order you set determines the order fields appear in on a person's edit and detail pages.

## Setting values on a person

On a person's edit page, every custom field template you've defined appears as an input, ready for a value. Leave any of them blank if they don't apply to that particular person.

## Filtering by custom field values

On the People page, you can filter your list down to people whose custom field matches a specific value using the `?cf=slug:value` URL parameter, for example `?cf=company:Acme`. This is useful for narrowing your list by anything you track as a custom field, like company, department, or a membership tier.

## Tier limits

In SaaS mode, the number of custom field templates you can define depends on your plan:

- **Free**: 1 custom field template
- **Personal**: up to 20 custom field templates
- **Pro**: unlimited custom field templates

Self-hosted installations are not subject to these limits.
