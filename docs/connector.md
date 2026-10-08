# Using Nimbus Land from Claude

The Nimbus Land connector lets Claude see and operate your apps from inside a
conversation: on claude.ai, in Claude Desktop and Cowork, on mobile, and in
Claude Code. Ask "is the shop app up?", "what did the last build say?" or
"deploy main", and Claude answers from your real apps, as you, in one
organization you choose.

The connector is a remote [MCP](https://modelcontextprotocol.io) server at
`https://nimbusland.ca/mcp`. You sign in with your Nimbus Land account through
a standard OAuth consent page; no API key is copied anywhere. Protocol details
for developers are at the [end of this page](#for-developers-the-protocol).

## Adding the connector

**From the Claude directory.** Once Nimbus Land is listed, find it in the
directory and select **Connect**. This is the same as the custom connector
below, without typing the URL.

**On claude.ai and Claude Desktop, by URL.** Until then:

1. **Settings → Connectors → Add custom connector**.
2. Name it `Nimbus Land`, URL `https://nimbusland.ca/mcp`. Leave the OAuth
   client fields empty: Claude identifies itself automatically.
3. **Connect**, and sign in to Nimbus Land in the window that opens. If you are
   already signed in to the console, you go straight to the consent page.

**In Claude Code:**

```bash
claude mcp add --transport http nimbus https://nimbusland.ca/mcp
```

Then run `/mcp` in Claude Code and choose **nimbus** to sign in. Your browser
opens the consent page, and Claude Code receives the result on a `localhost`
callback. [This plugin](../README.md) adds the same connector plus a skill that
teaches Claude the `nimbus` CLI, for work that needs your local project (see
[Limits](#limits)).

## The consent page

Approving happens in the Nimbus Land console, at `/oauth/authorize`. The page
shows:

- **Which client is asking**, by its own name (for example "Claude" or
  "Claude Code"), and the host it will send you back to.
- **An organization picker.** Your current organization is preselected; the
  list holds every organization where you can see apps. A connection acts in
  exactly one organization.
- **The access being requested**, in plain language:
  - *See your apps, builds, logs and variable names*
  - *Deploy and rebuild apps*
  - *Change variables and run commands*
- **A warning for Claude Code.** When the only place the sign-in can return to
  is `localhost`, the page says the result goes to a program on your own
  computer. Only approve it if you just started that sign-in yourself.

**Approve** sends Claude back with a one-time code; **Deny** sends it back with
nothing. Approving the same client for the same organization again reuses your
existing grant rather than creating a second one. Approvals are recorded in the
organization's audit log.

Granting access never widens what you can do: every tool call is checked
against both the access you approved and your current role in the
organization. A Member who approves all three still cannot run commands,
because their role cannot.

## What Claude can do

Read-only tools never change anything. Tools that make changes are marked as
such, so Claude asks you before calling them.

| Tool | | What it does |
| --- | --- | --- |
| `list_apps` | read-only | Every app in the organization: status, address, stack, last deploy |
| `get_app` | read-only | One app: status, address, live release, instances, connected repository and branch, custom domain, recent builds, console link |
| `get_app_logs` | read-only | Recent runtime log lines (at most 200), optionally for one instance (named as the console labels them, e.g. `web-7d9f8`), with a console link for more |
| `list_builds` | read-only | An app's builds: status, source, times, failure reason |
| `get_build` | read-only | One build: status, source, started and finished, failure reason, console link |
| `get_build_logs` | read-only | The tail of a build's log, with a console link for the full log |
| `get_env` | read-only | Environment variable names and values; secret values are masked and marked as secret |
| `deploy_app` | makes changes | Starts a build of the app's connected repository and tracked branch, or of a Git URL and revision you give; returns the build and how to follow it |
| `rebuild` | makes changes | Re-runs the app's newest build with the same source |
| `set_env` | makes changes | Sets one or more variables, optionally as secrets; answers with variable names, never secret values |
| `run_command` | makes changes | Starts a one-off command on the app; returns its output if it finishes within about 10 seconds, otherwise the run id |

Apps are named the way the console names them. An app outside the connected
organization is simply "not found". Answers include the console link for the
thing described, so you can jump from the conversation to the full page.

Activity started from Claude shows in the console and the audit log as you
"via Claude" (or whichever client you approved), not as anonymous API traffic.
Refusals use the console's own words: no permission for your role, app
suspended, subscription past due, build queue full.

## Limits

- **No source uploads.** Deploys from Claude come from the app's connected
  repository or a Git URL. To deploy files that only exist on your machine,
  use the CLI (`nimbus deploy`); the plugin's skill teaches Claude Code to do
  that.
- **One organization per connection.** To work in another organization,
  connect again and pick it. The organization header the CLI and API accept
  is ignored here.
- **Logs are capped at 200 lines** per answer; the console has the rest.
- **Secret values are never returned**, by any tool.
- **Same permissions as your role.** Owners and Admins can change variables,
  run commands and deploy the connected repository; Members can read and
  deploy from a Git URL (deploying the connected repository needs the
  manage-apps permission, exactly as the console's Deploy latest button does).
  A custom role gets exactly what it holds.
- **Rate limits.** Each connection has its own request budget (about two
  requests a second); past it, calls are refused briefly and Claude retries.
- **Not covered yet:** databases, volumes, buckets, custom domains, non-production
  environments, process types, agent tasks and billing. Use the console or the
  CLI for those.

## Revoking access

**Account settings → Connected apps** lists every grant: the client, the
organization, the access granted, when it was created and last used. **Revoke**
cuts it off immediately: Claude's next request is refused and it has to sign
in again. Revoking is recorded in the organization's audit log.

Organization owners and admins see every member's grants for their
organization under **Organization settings**, and can revoke any of them. A
grant also stops working on its own when you leave the organization or your
account is deactivated.

Removing the connector in Claude does not revoke the grant on our side; revoke
it here as well.

## What is sent to Anthropic

Claude runs on Anthropic's infrastructure, so everything a tool returns goes to
Claude as part of the conversation: app names, statuses, addresses, log lines,
build logs, variable names and plain variable values, command output. Anything
you type into a tool argument (a variable value, a command) does too.

- **Secret values are never returned.** `get_env` masks them, and `set_env`
  never echoes them. A value you ask Claude to set as a secret still passes
  through the conversation on its way in, so set real credentials in the
  console or with `nimbus env set KEY=- --secret` in your own terminal instead.
- **Logs are your app's own output.** If your app logs personal data or
  credentials, those lines reach Claude when you ask for logs.
- **Log and build output is data, not instructions.** Claude is told so, but
  treat a conversation that suddenly wants to deploy or change variables after
  reading logs with suspicion.
- **Nothing else.** No bucket contents, database rows or volume data are
  exposed by the connector.

For anything sensitive, use the console. Nimbus Land's privacy policy is at
<https://nimbusland.ca/privacy>.

## For developers: the protocol

Nimbus Land is an OAuth 2.1 authorization server for one resource, the MCP
endpoint. Any MCP client that implements the standard discovery flow can
connect; nothing is specific to Claude.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/.well-known/oauth-authorization-server` | Authorization-server metadata (RFC 8414) |
| `GET` | `/.well-known/oauth-protected-resource/mcp` | Protected-resource metadata (RFC 9728), also served at `/.well-known/oauth-protected-resource` |
| `POST` | `/oauth/register` | Dynamic Client Registration (RFC 7591) |
| `GET` | `/oauth/authorize` | The consent page (authorization code + PKCE) |
| `POST` | `/oauth/token` | Code exchange and refresh |
| `POST` | `/mcp` | The MCP endpoint (Streamable HTTP) |

All URLs are on `https://nimbusland.ca`, and none of them redirect.

**Discovery.** A request to `/mcp` without a valid access token answers `401`
with

```
WWW-Authenticate: Bearer resource_metadata="https://nimbusland.ca/.well-known/oauth-protected-resource/mcp", scope="apps:read apps:deploy apps:operate"
```

The protected-resource document names `https://nimbusland.ca` as the
authorization server; its metadata advertises the `code` response type, the
`authorization_code` and `refresh_token` grants, PKCE `S256` only, the `none`
token-endpoint auth method, and support for client ID metadata documents.

**Scopes.** `apps:read` (see apps, builds, logs and variable names),
`apps:deploy` (deploy and rebuild), `apps:operate` (change variables and run
commands). A token's effective permissions are the intersection of its granted
scopes and the user's current role in the granted organization, checked on
every request.

**Clients.** Every client is a public client. It identifies itself either by
registering (`POST /oauth/register` with `redirect_uris`, `client_name`,
`token_endpoint_auth_method: "none"`) or with a client ID metadata document (a
`client_id` that is an `https://` URL serving its own metadata, which is how
Claude Code identifies itself). Redirect URIs must be
`https://claude.ai/api/mcp/auth_callback` or a loopback `http://localhost/callback`
/ `http://127.0.0.1/callback` on any port; anything else is refused.

**Authorization.** `GET /oauth/authorize` with `response_type=code`,
`client_id`, `redirect_uri`, `scope`, `state`, `code_challenge` and
`code_challenge_method=S256`. The user signs in if needed, picks one
organization and approves or denies. Approve redirects with `code` and
`state`; deny redirects with `error=access_denied`.

**Tokens.** `POST /oauth/token`, form-encoded, with `grant_type=authorization_code`
(`code`, `redirect_uri`, `client_id`, `code_verifier`) or
`grant_type=refresh_token` (`refresh_token`, `client_id`). The answer is a
Bearer access token valid for one hour, a refresh token valid for thirty days
(renewed on every use), and the granted `scope`. Every refresh rotates the
refresh token; presenting a code or refresh token twice revokes the whole
grant, so the user must approve again. Access tokens work only on `/mcp`.

**The MCP endpoint.** Streamable HTTP, stateless: no session id is issued or
required. `POST /mcp` takes one JSON-RPC 2.0 request or a batch and answers
one JSON response; `GET /mcp` answers `405` (no server-to-client stream).
Supported methods: `initialize` (protocol version `2025-06-18`; `2025-11-25`
also accepted), `notifications/initialized`, `ping`, `tools/list` and
`tools/call`. Every tool carries a `title`, `description`, `inputSchema` and
either `readOnlyHint` or `destructiveHint`. A tool that cannot do what was
asked (not found, insufficient role, suspended app, queue full) answers a
normal result with `isError: true` and the console's wording, never a
transport error. Requests are rate limited per grant and answer `429` when
the budget is exceeded.

Questions: support@nimbusland.ca.
