# Using Nimbus Land from Claude

The Nimbus Land connector lets Claude see and operate your apps from inside a conversation: on claude.ai, in Claude Desktop, on mobile and in Claude Code. Ask "is the shop app up?", "what did the last build say?" or "deploy main", and Claude answers from your real apps, acting as you, in one organization you choose.

The connector is a remote [MCP](https://modelcontextprotocol.io) server at `https://nimbusland.ca/mcp`. You sign in with your Nimbus Land account on a standard consent page; no API key is copied anywhere. Protocol details for developers are at the [end of this page](#for-developers-the-protocol).

Claude runs on Anthropic's infrastructure, outside Canada. What the connector returns becomes part of your conversation with Claude; see [What is sent to Anthropic](#what-is-sent-to-anthropic).

Built your app with Claude and need somewhere to run it? See [Host an app you built with Claude](https://nimbusland.ca/claude-app-hosting).

## Adding the connector

Pick the block for where you use Claude. One sign-in to Nimbus Land serves all of them.

**In Claude Code.** Install [this plugin](../README.md): the connector plus a skill that teaches Claude how to deploy your project.

```sh
claude plugin marketplace add nimbus-land/claude-plugin
claude plugin install nimbus-land@nimbus-land
```

1. Restart Claude Code.
2. Run `/mcp`, choose **nimbus**, and sign in to Nimbus Land or create an account in the browser window that opens.
3. In your project, say: **Deploy this to Nimbus Land**.

**On claude.ai and in Claude Desktop.** Connect Nimbus Land from Claude's settings:

1. Open **Settings → Connectors** and find **Nimbus Land** in the directory.
2. Choose **Connect**, and sign in to Nimbus Land or create an account in the window that opens.
3. Under what you built, say: **Deploy this to Nimbus Land**.

One connection made this way also serves Claude on mobile.

**If Nimbus Land is not in your directory**, add the same connector by its address: **Settings → Connectors → Add custom connector**, name it `Nimbus Land`, enter `https://nimbusland.ca/mcp`, leave the OAuth client fields empty, and choose **Connect**.

**The connector only, without the skill** (Claude Code):

```sh
claude mcp add --transport http nimbus https://nimbusland.ca/mcp
```

Then run `/mcp` and choose **nimbus** to sign in. Your browser opens the consent page, and Claude Code receives the result on a `localhost` callback.

## The consent page

The consent page in the Nimbus Land console shows:

- **Which client is asking**, by its own name (for example "Claude" or "Claude Code"), and where it will send you back to.
- **The organization Claude will act in.** If you belong to one organization the page names it. If you belong to several you pick one, with your current organization preselected. A connection acts in exactly one organization.
- **Your free trial**, when that organization is in one: that the trial covers the deploy, how many days are left, and that no card is needed.
- **What it will be able to do**, in plain language:
  - *See your apps, builds, logs and variable names*
  - *Deploy and rebuild apps*
  - *Change environment variables and run one-off commands*
  - *See your managed databases and their status*
  - *Run read-only queries against your managed databases*
  - *Create storage for your apps*
- **A warning for Claude Code.** When the sign-in can only return to `localhost`, the page says the connection returns to an app running on your own computer. Only continue if you started that sign-in yourself.

Approving the same client for the same organization again reuses your existing grant. A connection approved before the database tools existed doesn't have database access, and one approved before volumes could be added doesn't have storage access: **Connected apps** in your account settings says which, and reconnecting from Claude adds it. Until then, asking for a volume is refused with that advice and everything else works as before. Approvals are recorded in your organization's audit log.

Approving never widens what you can do. Every tool call is checked against both the access you approved and your current role in the organization, so a Member who approves everything still can't run commands.

## What Claude can do

Read-only tools never change anything. Tools that make changes are marked as such, so Claude asks you before calling them.

| Tool | | What it does |
|---|---|---|
| `list_apps` | read-only | Every app in the organization: status, address, stack, last deploy, open alert incidents |
| `get_app` | read-only | One app: status, address, live release, instances, connected repository and branch, custom domain, volumes, estimated monthly cost, recent builds, console link |
| `get_app_logs` | read-only | Recent runtime log lines (at most 200), optionally for one environment and one instance, with a console link for more |
| `list_builds` | read-only | An app's builds: status, source, times, failure reason |
| `get_build` | read-only | One build: status, source, start and finish, failure reason, console link |
| `get_build_logs` | read-only | The end of a build's log, with a console link for the full log |
| `get_env` | read-only | Environment variable names and values; secret values are masked |
| `get_app_health` | read-only | A one-call summary: open incidents, alert rules, traffic figures, error groups and the slowest and failing operations |
| `get_traffic` | read-only | Request rate, error rate, response times and the most recent failed requests |
| `get_analytics` | read-only | Visitors and page views for `today`, `7d`, `30d` or `12m`: top pages, sources and devices |
| `get_browser_vitals` | read-only | Core Web Vitals, page-load phases and the slowest resources, when browser measurement is on |
| `list_errors` | read-only | The error groups seen in a time window: title, kind, location, counts, state |
| `get_error` | read-only | One error group: its trend and recent samples with stack traces |
| `list_traces` | read-only | The newest traces, optionally filtered by operation or to failures only |
| `get_trace` | read-only | One trace as a tree of spans, with durations, failures and attributes |
| `list_incidents` | read-only | An app's recent alert incidents, open ones first |
| `list_databases` | read-only | Every managed Postgres database: status, Postgres version, connected apps, console link |
| `query_database` | read-only | Runs one read-only SQL statement on a managed database and returns the rows (see [Limits](#limits)) |
| `detect_source` | read-only | A dry run over source files passed in the call: the detected stack, whether it is a static site, the volume the app needs to keep its data (folder, size, monthly price), the estimated monthly cost, and whether it is ready to deploy, needs a check, or is blocked and why. Stores nothing |
| `deploy_source` | makes changes | Deploys an app from source files passed in the call, or from a React artifact passed as one component (see [Deploying from Claude](#deploying-from-claude)). A new name creates the app. With `volume`, creates a volume and mounts it before the app first starts. A live answer gives the estimated monthly cost |
| `create_source_upload` | makes changes | For Claude Code: returns a one-time upload link and the one command that packs the project folder and sends it, which starts the build. Takes `volume` as `deploy_source` does |
| `wait_for_build` | makes changes | Follows one build for up to 45 seconds per call until it finishes: the live address with the app's estimated monthly cost, or the failure reason with the end of the build log. Changes nothing; it is listed as making changes because it waits |
| `deploy_app` | makes changes | Builds the app's connected repository and branch, or a Git URL and revision you give |
| `connect_repo` | makes changes | Connects a deployed app to a GitHub repository and branch your organization's GitHub App can reach, optionally turning deploy on push on. Deploys nothing by itself |
| `rebuild` | makes changes | Re-runs the app's newest build with the same source |
| `set_env` | makes changes | Sets one or more variables, optionally as secrets; never echoes secret values |
| `add_volume` | makes changes | Gives a deployed app a volume at a folder, so what the app saves there is kept. The app restarts; files already in that folder on the app's own disk are not copied. Answers with the volume, its monthly price and the app's estimated monthly cost |
| `add_sqlite_database` | makes changes | Gives a deployed app a SQLite database that is kept and backed up: the file lives on a volume, is copied continuously to backup storage, and the app stays at one instance. Use it, not `add_volume`, when the app's data is a SQLite file. |
| `run_command` | makes changes | Starts a one-off command; returns its output if it finishes within about 10 seconds, otherwise the run id |

Apps are named the way the console names them. The monitoring tools read the same figures as the app's **Monitoring** pages and **Analytics** tab (see [Traffic and analytics](https://nimbusland.ca/docs/traffic-and-analytics) and [Errors](https://nimbusland.ca/docs/errors)) and answer for production unless you name another environment. Answers include a console link, so you can jump from the conversation to the full page.

Activity started from Claude shows in the console and the audit log as you "via Claude" (or whichever client you approved). Refusals use the console's own words: no permission for your role, app suspended, subscription past due, build queue full.

## Deploying from Claude

Say "Deploy this to Nimbus Land" and Claude deploys what you are working on. How the files get to the platform depends on where they are.

**In a chat (claude.ai, Claude Desktop, mobile).** The app is in the conversation, so Claude passes the files in the tool call itself (`deploy_source`). It usually checks them first with `detect_source`, which says what the platform detected and whether anything stops the deploy, without storing anything. Then it follows the build with `wait_for_build` and gives you the address.

**In Claude Code.** The app is a folder on your computer, so Claude asks the platform for a one-time upload link (`create_source_upload`) and runs one command in your project folder. You see the command and approve it once. It packs the folder and sends it to Nimbus Land; then Claude follows the build the same way. You do not need the `nimbus` CLI and you do not sign in a second time: the connector is the only thing you approved.

| | In a chat (`deploy_source`) | In Claude Code (`create_source_upload`) |
| --- | --- | --- |
| Size limit | 1 MiB and 500 files | 100 MiB after the exclusions |
| Where the files travel | Through the conversation | From your computer straight to Nimbus Land |
| Left out | You choose the files; `node_modules` and `.git` are refused | `.git`, dependency and build-output folders (`node_modules`, `_build`, `deps`, `dist`, `build`, `target`, `.next`, `.nuxt`, virtualenvs, editor folders) and `.env` files |

What to expect either way:

- **A new name creates the app.** A name that is already one of your apps gets a new build. App names are unique across Nimbus Land, so a name someone else holds is refused with a suggested free one.
- **What deploys.** A server that listens on the `PORT` variable on all interfaces, or a static site (files in a folder with an `index.html`). A `Dockerfile` at the top of the project decides the build when there is one.
- **Billing.** On a free trial or a plan the deploy just runs. If billing stops it, Claude relays why with the address of your Billing page; once that is sorted, ask it to deploy again.
- **A failed build** comes back with the reason and the last lines of the build log, and a link to the full log in the console.
- **Secrets do not go through a deploy.** Variables whose names look like secrets are refused there. Set them afterwards with `set_env` as a secret, or in the console.

**About the upload command.** The link in it works once, for ten minutes, for that one app name, and Nimbus Land keeps only a fingerprint of it. It is sent in a request header, so it does not appear in web server logs. It does appear in your conversation and your shell history; someone who copied it within those ten minutes could deploy one build of that one app, recorded under your name. A second run of the same command is refused. The command needs a POSIX shell (bash or zsh; Git Bash on Windows, which is what Claude Code uses).

**When the `nimbus` CLI is still the right tool:** in CI and other automation, for projects over 100 MiB, when the connector is not connected, or when you would rather deploy from your own terminal.

### Data your app keeps

An app's own disk is not kept. Every deploy and every restart starts the app from a fresh copy, so a SQLite database, uploaded files or anything else the app saved to its disk is gone. Data to keep goes on a **volume**: storage mounted at a folder inside the app, which stays through deploys and restarts.

- **Before a deploy.** `detect_source` tells Claude when the app needs one: a suggested volume with its folder, size and monthly price, or, when it finds SQLite and cannot tell where the file lives, a request to find the folder in the code. Claude tells you the price and asks. If you agree it passes `volume` (a folder such as `/data`, and a size in GB, 1 by default) to `deploy_source` or `create_source_upload`, and the volume is there when the app first starts.
- **Nothing is added without your yes.** A deploy without `volume` creates no storage. If the app looks like it saves data, the deploy's answer says the data will not be kept and how to fix it.
- **An app that is already deployed.** `add_volume` gives it a volume at a folder, for uploads and other files. The app restarts, and files that were in that folder on the app's own disk are **not** copied into the volume: what the app saved before is gone, and what it saves from then on is kept. `get_app` lists an app's volumes, or says it has none.
- **An app whose data is a SQLite file.** `add_sqlite_database` gives a deployed app the same SQLite database the console's **Add database** does. Claude passes the path of the file the app opens (`/data/app.db` by default). The file is kept on a volume (one is created at `/data`, or a volume the app already has is used), it is copied continuously to backup storage so it can be restored to a point in time from the app's page, the app gets `DATABASE_URL` and `SQLITE_DB_PATH`, and the app is kept at one instance. The app restarts, and a database file that was on the app's own disk is **not** copied: the app starts with an empty database. One per app. Creating the volume needs storage access; using a volume the app has does not.
- **The connection needs storage access.** *Create storage for your apps* is one of the lines on the approval page. A connection approved before it existed gets a sentence telling you to reconnect; everything else keeps working.
- **Deploying the same app again** with the same folder keeps the volume it has.
- **Not for static sites.** A static site has no disk to mount a volume on.

**What it costs.** `detect_source` gives an estimated monthly cost before anything is deployed: the instance at the recommended size plus any suggested volume, with the total. Once the app is live, the deploy's answer, `wait_for_build`, `get_app`, `add_volume` and `add_sqlite_database` give the app's estimated monthly cost at your organization's prices, the same figure the app's page shows. During a free trial the answer says the trial covers it for now. A static site has no instance price.

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

### Moving an app to a GitHub repository

An app Claude deployed from files or an artifact has no repository. Once you have one for it, ask Claude to "connect this app to `owner/name`", or pick the repository on the app's **Deployments** tab under **Deploy settings**. See [Connecting a repository to an app you already deployed](https://nimbusland.ca/docs/deploying#connecting-a-repository-to-an-app-you-already-deployed).

- **Connecting deploys nothing.** The next deploy builds the repository's branch; the files Claude uploaded are not used again. Variables, volumes, domains and size stay.
- **Deploy on push is off unless you ask for it.** Claude tells you first that every push to the branch will deploy, that anyone who can push can trigger one, and that those deploys run as you.
- **A React artifact needs the whole project in the repository.** Nimbus Land built a project around the component; a repository holding only the component will not build the same site. Ask Claude to "turn this into a full Vite project" and commit that.
- **The repository must be one your organization's GitHub App can reach.** If it isn't, Claude lists the ones that are; an organization admin adds more from **Manage repository access** on the same tab.

## Mods in Claude Code

Nimbus Land's second plugin for Claude Code, `nimbus-land-mods`, changes what a deploy looks like while it happens. Claude Code calls these changes mods. They appear wherever Claude Code runs with that plugin installed: the terminal, the desktop app's Code tab, the VS Code extension, and the mobile app attached to such a session. A claude.ai chat that only has the connector does not get them.

The mods plugin is installed from its own repository, not from the Claude plugin directory, which does not yet accept mods from us:

```bash
claude plugin marketplace add nimbus-land/claude-mods
claude plugin install nimbus-land-mods@nimbus-land-mods
```

It uses the Nimbus Land connector you are already signed in to, whether that came from the Claude directory, from the `nimbus-land` plugin or from `claude mcp add`.

- **Deploy card.** Under each deploy, rebuild or wait call, a card shows the app's name, whether it is Building, Live or Failed, how long it took, the app's address as a link once it is live, and a link to the build in the console. A failed build shows the reason and the last lines of the build log.
- **Build follow.** When a deploy call returns before the build has finished, the mods keep waiting on that build. The status line shows "building" and the app's name, the card updates, and one notice tells you when the app is live or the build failed, even if the conversation has moved on.
- **Apps pane.** Type `/nimbus` to open a pane beside the chat that lists the organization's apps: name, status, address, and a mark on any app with an open alert incident. It refreshes when you open it, after each deploy, and once a minute while it is open. It opens only when you ask for it.

What the mods do by themselves: they call two read-only connector tools, `wait_for_build` and `list_apps`, as you, through the connector you signed in to. Following a build stops after ten minutes. They make no other network request, read no files, start no programs and keep nothing after the session ends. Anything that changes an app is still done only by Claude, with your approval.

To turn the mods off, disable or uninstall that plugin (`/plugin`, then **nimbus-land-mods**). The connector and the `nimbus-land` plugin are not affected.

The mods use an early-access part of Claude Code, so a Claude Code update can stop them from loading. The connector and the `nimbus-land` plugin keep working when that happens.

## Limits

- **New here? Claude can deploy on your free trial.** A new account starts with a [free trial](https://nimbusland.ca/docs/first-app#your-free-trial), no card needed, so Claude can deploy your first app straight away. If you signed up with an email and a password, confirm your address first: until then Claude tells you to open the link we emailed you, with the address of the page that sends it again. Once you have confirmed, ask it to deploy again. Signing up with GitHub or Google skips that step. When something is outside the trial (a third app, a larger size, AI), Claude relays the same sentence the console shows, with a link to **Billing**.
- **One organization per connection.** To work in another organization, connect again and pick it.
- **Logs are capped at 200 lines** per answer; the console has the rest.
- **Secret values are never returned** by any tool.
- **Same permissions as your role.** Owners and Admins can change variables, run commands, deploy and query databases. Members can read, deploy from a Git URL, and see databases, but not query them (deploying the connected repository needs the **Manage apps** permission, as in the console). A custom role gets exactly what it holds.
- **Database queries are read-only and bounded.** `query_database` needs the **Connect to databases** permission. It runs one statement in a read-only transaction, through a 15-minute database session opened for you "via Claude", which shows on the database's page and ends on its own. Writes are refused, results stop at 200 rows and about 64 KB, values longer than 500 characters are shortened, and a statement is cancelled after 15 seconds. Each query is recorded in the audit log with its statement and row count, never the rows.
- **Rate limits.** Each connection has its own request budget, about two requests a second. Past it, calls are briefly refused and Claude retries.
- **Source size.** Files passed in a chat are limited to 1 MiB and 500 files; a one-time upload from Claude Code to 100 MiB. Each organization can start about ten source deploys a minute.
- **Not covered yet:** creating databases, writing to databases, resizing or removing volumes, buckets, custom domains, non-production environments (other than reading their logs and monitoring data), process types and billing. Use the console or the CLI for those.

## Revoking access

**Connected apps** in your account settings lists every grant: the client, the organization, the access granted, when it was created and last used. **Revoke** cuts it off immediately; Claude has to sign in again. Revoking is recorded in the audit log.

Organization owners and admins see every member's grants under **Connected apps** in the organization settings, and can revoke any of them. A grant also stops working when you leave the organization or your account is deactivated.

Removing the connector in Claude does not revoke the grant on our side. Revoke it in Nimbus Land as well.

## What is sent to Anthropic

Everything a tool returns goes to Claude as part of the conversation: app names, statuses, addresses, log lines, build logs, variable names and plain variable values, command output, query results. Anything you put in a tool argument (a variable value, a command, a SQL statement) does too.

- **Source you deploy from a chat goes through the conversation.** With `deploy_source` and `detect_source`, every file Claude passes and every build variable is part of the conversation. A one-time upload from Claude Code is different: the files go from your computer to Nimbus Land and are not sent to Anthropic by the upload, though Claude has usually read some of them while working on the project.

- **Secret values are never returned.** `get_env` masks them and `set_env` never echoes them. A value you ask Claude to set as a secret still passes through the conversation on its way in, so set real credentials in the console or with `nimbus env set KEY=- --secret` in your own terminal.
- **Logs are your app's own output.** If your app logs personal data or credentials, those lines reach Claude when you ask for logs.
- **Monitoring data is your app's and your visitors' content.** Error messages, stack traces, span names and attributes, request paths, page URLs and referrers go to Claude when you ask about errors, traces or traffic. Lists are capped, each line is cut at 2,048 bytes, and a stack trace is cut at 50 lines.
- **Database rows you query go to Claude.** Whatever the selected columns hold (personal data, password hashes, tokens your app stores) reaches Anthropic. Select only the columns you need, or query from your own machine with `nimbus db shell`.
- **Log, build and query output is data, not instructions.** Claude is told so, but treat a conversation that suddenly wants to deploy or change variables after reading logs with suspicion.
- **Nothing else.** No bucket contents or volume data are exposed by the connector.

For anything sensitive, use the console. Nimbus Land's privacy policy is at [nimbusland.ca/privacy](https://nimbusland.ca/privacy).

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
WWW-Authenticate: Bearer resource_metadata="https://nimbusland.ca/.well-known/oauth-protected-resource/mcp", scope="apps:read apps:deploy apps:operate databases:read databases:query storage:write"
```

The protected-resource document names `https://nimbusland.ca` as the
authorization server; its metadata advertises the `code` response type, the
`authorization_code` and `refresh_token` grants, PKCE `S256` only, the `none`
token-endpoint auth method, and support for client ID metadata documents.

**Scopes.** `apps:read` (see apps, builds, logs and variable names),
`apps:deploy` (deploy and rebuild), `apps:operate` (change variables and run
commands), `databases:read` (see managed databases and their status),
`databases:query` (run read-only queries against them) and `storage:write`
(create storage for apps). A token's effective permissions are the
intersection of its granted scopes and the user's current role in the granted
organization, checked on every request.

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
