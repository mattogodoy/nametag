# MCP Server (AI Integration)

Nametag ships with a lightweight MCP server that exposes read and write tools/resources for AI clients.

## Run locally

```bash
npm run mcp:dev
```

By default the MCP server listens on `http://127.0.0.1:3333/mcp`.

### Optional environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `MCP_PORT` | Port for the MCP HTTP server | `3333` |
| `MCP_HOST` | Host interface to bind | `127.0.0.1` |
| `MCP_AUTH_TOKEN` | Shared bearer token for single-user/dev usage | _unset_ |
| `MCP_DEFAULT_USER_ID` | Default user ID for single-user/dev usage | _unset_ |
| `MCP_REQUIRE_AUTH` | Force auth ("true"/"false") | `true` in production, otherwise `false` |

### Authentication

Preferred: send a NextAuth session token in the `Authorization` header. The MCP server will decode the JWT and derive the `userId` from it, ensuring each user only accesses their own data.

```
Authorization: Bearer <nextauth-session-token>
```

If you want a simple single-user/local setup, you can set both `MCP_AUTH_TOKEN` and `MCP_DEFAULT_USER_ID`, then send `Authorization: Bearer <MCP_AUTH_TOKEN>`.

## Tools

Read tools:
- `list_people` — list people (recently updated)
- `search_people` — search people by name/surname/nickname
- `get_person` — fetch a person record with groups and important dates
- `list_groups` — list groups
- `list_relationship_types` — list relationship types

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
