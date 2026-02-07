# MCP Server (AI Integration)

Nametag ships with a lightweight MCP server that exposes read and write tools/resources for AI clients.

## Run locally

```bash
npm run mcp:dev
```

By default the MCP server listens on `http://127.0.0.1:3333/mcp`.

The MCP server proxies requests to the Nametag HTTP API. Run the API locally (e.g. `npm run dev`) and configure `MCP_API_BASE_URL` if needed.

### Optional environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `MCP_PORT` | Port for the MCP HTTP server | `3333` |
| `MCP_HOST` | Host interface to bind | `127.0.0.1` |
| `MCP_API_BASE_URL` | Base URL for the Nametag HTTP API | `http://127.0.0.1:3000` |
| `MCP_REQUIRE_AUTH` | Force auth ("true"/"false") | `true` in production, otherwise `false` |

### Authentication

Preferred: send a NextAuth session token in the `Authorization` header. The MCP server forwards this token to the HTTP API and the API enforces user scoping.

```
Authorization: Bearer <nextauth-session-token>
```

All tools are scoped to the authenticated user. Relationship type tools return only non-deleted types and enforce inverse pairing within the same user.

## Tools

Read tools:
- `list_people` — list people (recently updated)
- `search_people` — search people by name/surname/nickname
- `get_person` — fetch a person record with groups and important dates
- `list_groups` — list groups
- `list_relationship_types` — list relationship types
- `list_relationships` — list person↔person relationships with relationship type and minimal person info (filters: `personId`, `relatedPersonId`, `relationshipTypeId`)
- `list_relationships_to_user` — list person→user relationships (relationshipToUser) with relationship type and minimal person info (filters: `relationshipTypeId`, `relationshipTypeName`)

Write tools:
- `create_person`, `update_person`, `delete_person`
- `create_group`, `update_group`, `delete_group`
- `add_group_member`, `remove_group_member`
- `create_relationship_type`, `update_relationship_type`, `delete_relationship_type`
- `create_relationship`, `update_relationship`, `delete_relationship`
- `add_important_date`, `update_important_date`, `delete_important_date`

## Resources

- `nametag://people/{personId}` — read a person record as JSON

## Example MCP client config

```json
{
  "mcpServers": {
    "nametag": {
      "url": "http://127.0.0.1:3333/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_NEXTAUTH_SESSION_TOKEN"
      }
    }
  }
}
```

### Finding your NextAuth token

In a browser session, copy the value of the `next-auth.session-token` (or `__Secure-next-auth.session-token`) cookie and use it as the bearer token for MCP requests.

## Smoke test

```bash
npm run mcp:smoke
```
