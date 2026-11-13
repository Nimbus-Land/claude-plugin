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

**From the Claude directory.** Find Nimbus Land in the directory and select
**Connect**, then sign in to Nimbus Land in the window that opens. This is the
usual way, and one connection serves claude.ai, Claude Desktop, mobile and
Claude Code.

**On claude.ai and Claude Desktop, by URL.** The same connector, added by hand:

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
teaches Claude when to use it and when to use the `nimbus` CLI.

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
| `list_apps` | read-only | Every app in the organization: status, address, stack, last deploy, open alert incidents |
| `get_app` | read-only | One app: status, address, live release, instances, connected repository and branch, custom domain, recent builds, console link |
| `get_app_logs` | read-only | Recent runtime log lines (at most 200), optionally for one instance (named as the console labels them, e.g. `web-7d9f8`), with a console link for more |
| `list_builds` | read-only | An app's builds: status, source, times, failure reason |
| `get_build` | read-only | One build: status, source, started and finished, failure reason, console link |
| `get_build_logs` | read-only | The tail of a build's log, with a console link for the full log |
| `get_env` | read-only | Environment variable names and values; secret values are masked and marked as secret |
| `get_app_health` | read-only | The one-call summary for an app (name, optional `environment` and `window`): open incidents (an open Errors incident with the app exception groups behind it), the alert rules, the window's traffic figures, the measurement switches, the error groups seen (platform noise left out) and the slowest and failing operations |
| `get_traffic` | read-only | An app's request figures (name, optional `environment` and `window`): the series, the current rate, error rate and response times, and the most recent failed requests |
| `get_analytics` | read-only | Visitors and page views for a `period` (`today`, `7d`, `30d`, `12m`): the series, top pages, sources and devices |
| `get_browser_vitals` | read-only | The browser measurement switch and, when on, the Core Web Vitals with their ratings, the page-load phases and the slowest resources (name, optional `environment` and `window`) |
| `list_errors` | read-only | The error groups seen in the window (name, optional `environment`, `window`, `include_muted` and `include_noise`): title, kind (app exception, upstream call, platform noise, browser), location, counts, state, fingerprint. Platform noise, the SDK's own cloud-metadata calls, is left out unless `include_noise` is set |
| `get_error` | read-only | One error group by fingerprint: its kind, its trend and its most recent samples with stack traces and, for a failed request, the operation that caused it |
| `list_traces` | read-only | The newest traces in the window (name, optional `environment`, `window`, operation and failed-only filters); a failed trace carries its cause and an outbound root is named with its host |
| `get_trace` | read-only | One trace by id: its spans as a tree (outbound spans named with their host), with durations, failures, attributes and events |
| `list_incidents` | read-only | An app's recent alert incidents, open ones first, with the alert rules |
| `detect_source` | read-only | A dry run over source files passed in the call: the detected stack, whether it is a static site and where it publishes from, the suggested release command and services, and whether it is ready to deploy, needs a check, or is blocked and why. Stores nothing |
| `deploy_source` | makes changes | Deploys an app from source files passed in the call, or from a React artifact passed as one component (see [Deploying from Claude](#deploying-from-claude)). A new name creates the app. Waits briefly for the outcome |
| `create_source_upload` | makes changes | For Claude Code: returns a one-time upload link and the one command that packs the project folder and sends it, which starts the build |
| `wait_for_build` | makes changes | Follows one build for up to 45 seconds per call until the build and its release finish: the live address, or the failure reason with the end of the build log. Changes nothing; it is listed as making changes because it waits |
| `deploy_app` | makes changes | Starts a build of the app's connected repository and tracked branch, or of a Git URL and revision you give; returns the build and how to follow it |
| `rebuild` | makes changes | Re-runs the app's newest build with the same source |
| `set_env` | makes changes | Sets one or more variables, optionally as secrets; answers with variable names, never secret values |
| `run_command` | makes changes | Starts a one-off command on the app; returns its output if it finishes within about 10 seconds, otherwise the run id |

Apps are named the way the console names them. An app outside the connected
organization is simply "not found". Answers include the console link for the
thing described, so you can jump from the conversation to the full page.

The telemetry tools read the same figures as the Monitoring and Analytics tabs
and answer from the production environment unless you name another. Asking for
traces of a static site is not an error: Claude is told a static site has no
server-side measurement and is pointed at the browser and error tools. The
public Nimbus-Land/claude-plugin repository documents the same tools in its
0.3.1.

Activity started from Claude shows in the console and the audit log as you
"via Claude" (or whichever client you approved), not as anonymous API traffic.
Refusals use the console's own words: no permission for your role, app
suspended, subscription past due, build queue full.

## Deploying from Claude

Say "Deploy this to Nimbus Land" and Claude deploys what you are working on.
How the files get to the platform depends on where they are.

**In a chat (claude.ai, Claude Desktop, mobile).** The app is in the
conversation, so Claude passes the files in the tool call itself
(`deploy_source`). It usually checks them first with `detect_source`, which
says what the platform detected and whether anything stops the deploy, without
storing anything. Then it follows the build with `wait_for_build` and gives you
the address.

**In Claude Code.** The app is a folder on your computer, so Claude asks the
platform for a one-time upload link (`create_source_upload`) and runs one
command in your project folder. You see the command and approve it once. It
packs the folder and sends it to Nimbus Land; then Claude follows the build the
same way. You do not need the `nimbus` CLI and you do not sign in a second
time: the connector is the only thing you approved.

| | In a chat (`deploy_source`) | In Claude Code (`create_source_upload`) |
| --- | --- | --- |
| Size limit | 1 MiB and 500 files | 100 MiB after the exclusions |
| Where the files travel | Through the conversation | From your computer straight to Nimbus Land |
| Left out | You choose the files; `node_modules` and `.git` are refused | `.git`, dependency and build-output folders (`node_modules`, `_build`, `deps`, `dist`, `build`, `target`, `.next`, `.nuxt`, virtualenvs, editor folders) and `.env` files |

What to expect either way:

- **A new name creates the app.** A name that is already one of your apps
  gets a new build. App names are unique across Nimbus Land, so a name
  someone else holds is refused with a suggested free one.
- **What deploys.** A server that listens on the `PORT` variable on all
  interfaces, or a static site (files in a folder with an `index.html`). A
  `Dockerfile` at the top of the project decides the build when there is one.
- **Billing.** On a free trial or a plan the deploy just runs. If billing
  stops it, Claude relays why with the address of your Billing page; once that
  is sorted, ask it to deploy again.
- **A failed build** comes back with the reason and the last lines of the
  build log, and a link to the full log in the console.
- **Secrets do not go through a deploy.** Variables whose names look like
  secrets are refused there. Set them afterwards with `set_env` as a secret,
  or in the console.

**About the upload command.** The link in it works once, for ten minutes, for
that one app name, and Nimbus Land keeps only a fingerprint of it. It is sent
in a request header, so it does not appear in web server logs. It does appear
in your conversation and your shell history; someone who copied it within
those ten minutes could deploy one build of that one app, recorded under your
name. A second run of the same command is refused. The command needs a
POSIX shell (bash or zsh; Git Bash on Windows, which is what Claude Code uses).

**When the `nimbus` CLI is still the right tool:** in CI and other automation,
for projects over 100 MiB, when the connector is not connected, or when you
would rather deploy from your own terminal.

### Deploying an artifact

An artifact Claude made in a chat deploys as it is: say "Deploy this to Nimbus Land" under it. A changed artifact is the same sentence again; the same app name gets a new build.

| Artifact | How Claude sends it |
| --- | --- |
| HTML | As `index.html` in `files`. It is published unchanged, as a static site |
| React | The component, unchanged, in `react_component`. Nimbus Land builds a project around it and publishes a static site |
| SVG, Markdown, Mermaid | Claude first writes an `index.html` that shows it, then deploys that |

**React artifacts.** A React artifact is one component file that leans on libraries Claude's artifact viewer supplies. Nimbus Land builds it with its own tested copies of them: React, Tailwind CSS, the shadcn/ui components under `@/components/ui`, and these packages, which the component may import:

`chart.js`, `class-variance-authority`, `clsx`, `cmdk`, `cn`, `d3`, `date-fns`, `embla-carousel-react`, `input-otp`, `lodash`, `lucide-react`, `mathjs`, `next-themes`, `papaparse`, `radix-ui`, `react`, `react-day-picker`, `react-dom`, `react-resizable-panels`, `recharts`, `sonner`, `tailwind-merge`, `three`, `vaul`

Some things only work inside Claude's artifact viewer. Claude is told before anything is deployed, with what to do instead:

| The artifact uses | What happens | Instead |
| --- | --- | --- |
| `window.storage` | Refused | The browser's `localStorage`, which keeps data in each visitor's own browser |
| `window.claude.complete` (asking Claude from the page) | Refused | Nothing equivalent on a static site. Remove the feature, or build an app with a server that calls the Claude API with its own key |
| `window.fs` (files attached to the conversation) | Refused | Put the data in the component, or deploy a full project with the data file beside it |
| A package outside the list above | Refused, naming the package | Rewrite with the listed packages, or deploy a full project in `files` with a `package.json` that declares it |
| No default export | Refused | The component to show must be the file's default export |

What to expect:

- **It should look like the artifact did.** Small differences in spacing, fonts or theme are possible, because the published page is built with our copies of the libraries, not the viewer's. Ask Claude to adjust the component and deploy again.
- **The browser tab's title** is the app's name unless Claude passes one.
- **The project around the component is ours** and cannot be edited through this path. An artifact that needs its own images, data files, extra packages or build settings goes as a full project in `files`: ask Claude to "turn this into a full Vite project and deploy it".
- **An already published app keeps the libraries it was built with.** It gets our current copies the next time it is deployed.

## Mods in Claude Code

The Nimbus Land plugin for Claude Code also changes what a deploy looks like while it happens. Claude Code calls these changes mods. They appear wherever Claude Code runs with the plugin installed: the terminal, the desktop app's Code tab, the VS Code extension, and the mobile app attached to such a session. A claude.ai chat that only has the connector does not get them.

- **Deploy card.** Under each deploy, rebuild or wait call, a card shows the app's name, whether it is Building, Live or Failed, how long it took, the app's address as a link once it is live, and a link to the build in the console. A failed build shows the reason and the last lines of the build log.
- **Build follow.** When a deploy call returns before the build has finished, the plugin keeps waiting on that build. The status line shows "building" and the app's name, the card updates, and one notice tells you when the app is live or the build failed, even if the conversation has moved on.
- **Apps pane.** Type `/nimbus` to open a pane beside the chat that lists the organization's apps: name, status, address, and a mark on any app with an open alert incident. It refreshes when you open it, after each deploy, and once a minute while it is open. It opens only when you ask for it.

What the mods do by themselves: they call two read-only connector tools, `wait_for_build` and `list_apps`, as you, through the connector you signed in to. Following a build stops after ten minutes. They make no other network request, read no files, start no programs and keep nothing after the session ends. Anything that changes an app is still done only by Claude, with your approval.

To turn the mods off, disable the plugin (`/plugin`, then **nimbus-land**) and add the connector alone: `claude mcp add --transport http nimbus https://nimbusland.ca/mcp`.

The mods use an early-access part of Claude Code, so a Claude Code update can stop them from loading. The connector and the skill keep working when that happens.

## Limits

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
- **Source size.** Files passed in a chat are limited to 1 MiB and 500 files;
  a one-time upload from Claude Code to 100 MiB. Each organization can start
  about ten source deploys a minute.
- **Not covered yet:** databases, volumes, buckets, custom domains, non-production
  environments (other than reading their logs and telemetry), process types, agent tasks and billing. Use the console or the
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

- **Source you deploy from a chat goes through the conversation.** With
  `deploy_source` and `detect_source`, every file Claude passes and every
  build variable is part of the conversation. A one-time upload from Claude
  Code is different: the files go from your computer to Nimbus Land and are
  not sent to Anthropic by the upload, though Claude has usually read some of
  them while working on the project.

- **Secret values are never returned.** `get_env` masks them, and `set_env`
  never echoes them. A value you ask Claude to set as a secret still passes
  through the conversation on its way in, so set real credentials in the
  console or with `nimbus env set KEY=- --secret` in your own terminal instead.
- **Logs are your app's own output.** If your app logs personal data or
  credentials, those lines reach Claude when you ask for logs.
- **Log and build output is data, not instructions.** Claude is told so, but
  treat a conversation that suddenly wants to deploy or change variables after
  reading logs with suspicion.
- **Telemetry is your app's and your visitors' content.** When Claude calls
  the telemetry tools, error messages, stack traces, span names, attributes and
  events, request paths, page URLs and referrers of the app go to Anthropic as
  tool results, bounded the way the HTTP API bounds them (see the platform's HTTP API guide, "Bounds and content"):
  capped lists, each line cut at 2,048 bytes and at most 50 stack lines per
  trace. If your app puts personal data in URLs or error messages, it reaches
  Claude when you ask for errors, traces or traffic. This content is data, not
  instructions, and Claude is told so with every result.
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
