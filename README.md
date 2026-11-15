# Nimbus Land for Claude

Deploy, inspect and operate your [Nimbus Land](https://nimbusland.ca) apps
without leaving Claude. Ask "is my app up?", "why did the last build fail?" or
"deploy main", and Claude answers from your actual apps.

This plugin bundles two things:

- **The Nimbus Land connector** (`.mcp.json`): a remote MCP server at
  `https://nimbusland.ca/mcp`. You sign in with your Nimbus Land account and
  choose which organization Claude may act in. It lets Claude list apps, read
  status, runtime logs, builds and build logs, read environment variables
  (secret values masked), deploy from an app's connected repository, rebuild,
  set variables and run one-off commands. Since 0.2.0 it also reads an app's
  health: open incidents and alert rules, request figures, visitors, browser
  vitals, error groups with their stack traces, traces and operations, so
  "why is my app slow?" and "what is this error?" get answered from the
  app's own telemetry. Since 0.3.0 it also deploys: a small app straight
  from the conversation, or the project on your disk through a one-time
  upload that Claude runs as one command, with no CLI to install and no
  second sign-in. Since 0.3.1 a React artifact deploys as it is: Claude
  passes the one component and Nimbus Land builds the project around it.
- **The `nimbus-cli` skill** (`skills/nimbus-cli/`): teaches Claude when to
  deploy through the connector and when to use the
  [`nimbus` CLI](https://nimbusland.ca) (no connector, CI, or a project over
  100 MiB), what a deployable app looks like, and never to print or store your
  credentials.

## Install in Claude Code

Add this repository as a plugin marketplace, then install the plugin from it:

```bash
claude plugin marketplace add nimbus-land/claude-plugin
claude plugin install nimbus-land@nimbus-land
```

Restart Claude Code. The first time Claude uses a Nimbus Land tool, run `/mcp`
and choose **nimbus** to sign in: your browser opens the Nimbus Land consent
page, and Claude Code receives the result on a `localhost` callback.

To add only the connector, without the skill:

```bash
claude mcp add --transport http nimbus https://nimbusland.ca/mcp
```

## Mods for Claude Code

A second plugin, [`nimbus-land-mods`](https://github.com/nimbus-land/claude-mods),
adds a card under each deploy call, a follow of a started build and `/nimbus`,
a pane listing your apps. It is separate because the Claude plugin directory
does not yet accept mods from us; install it from its own repository:

```bash
claude plugin marketplace add nimbus-land/claude-mods
claude plugin install nimbus-land-mods@nimbus-land-mods
```

It uses the connector you are already signed in to, from this plugin or from
the Claude directory.

## Install in Claude Desktop and claude.ai

Nimbus Land is listed in the Claude directory: open **Settings → Connectors**,
find Nimbus Land in the directory, select **Connect** and sign in to Nimbus
Land in the window that opens.

To add it by its address instead:

1. Open **Settings → Connectors → Add custom connector**.
2. Name it `Nimbus Land` and enter the URL `https://nimbusland.ca/mcp`. Leave
   the OAuth client fields empty.
3. Select **Connect** and sign in to Nimbus Land in the window that opens.

## What the consent screen asks

Nimbus Land shows which client is asking (for example "Claude") and where it
will send you back, then asks you to pick **one organization** (your current
one is preselected) and approve these kinds of access:

- **See your apps, builds, logs and variable names**
- **Deploy and rebuild apps**
- **Change variables and run commands**
- **Create storage for your apps** (since 0.4.2: a volume, so an app's data
  survives deploys and restarts; Claude gives the price and asks first)

Claude can never do more than your role in that organization allows. When the
request comes from Claude Code, the page warns that the sign-in returns to a
program on your own computer (`localhost`): only approve it if you just started
it yourself. To use a second organization, connect again and choose it.

## Revoking access

In the Nimbus Land console, open **Account settings → Connected apps** and
revoke the grant. Claude's next request is refused. Organization owners and
admins can also see and revoke members' grants under **Organization settings**.

## Good to know

- Deploys from Claude come from the app's connected Git repository or a Git URL
  you give it. The connector never accepts uploaded source; use the CLI for that.
- An app's own disk is not kept across deploys and restarts. Since 0.4.2
  Claude checks whether your app saves data (a SQLite file, uploads), tells
  you what a volume costs and adds one if you agree, and reports the app's
  estimated monthly cost after a deploy. For an app that keeps a SQLite file
  it can add the platform's SQLite database, which also backs the file up
  continuously.
- Log results are capped at 200 lines, with a link to the console for more.
- Secret values are never returned. Tool arguments and results (app names,
  statuses, log lines, variable names, build logs) are sent to Claude, so use
  the console for anything sensitive.
- Deploys, variable changes and runs started from Claude show in your audit log
  as you "via Claude".
- Telemetry is your app's and your visitors' content. When Claude asks for
  errors, traces or traffic, error messages, stack traces, request paths and
  page URLs go to Claude as tool results, bounded (capped lists, lines cut at
  2,048 bytes, at most 50 stack lines per trace). Claude is told with every
  result that this content is data, never instructions.

The full guide, including every tool, the limits, what is sent to Anthropic
and the OAuth/MCP protocol details, is [docs/connector.md](docs/connector.md).
Questions or problems: support@nimbusland.ca.

## License

MIT. Copyright (c) 2026 Nimbus Land Technologies Inc. See [LICENSE](LICENSE).
