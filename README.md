# Nimbus Land for Claude

Deploy, inspect and operate your [Nimbus Land](https://nimbusland.ca) apps
without leaving Claude. Ask "is my app up?", "why did the last build fail?" or
"deploy main", and Claude answers from your actual apps.

This plugin bundles three things:

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
- **Mods for Claude Code** (`hooks/`, since 0.4.0): a card under each deploy
  call that reads Building, Live or Failed with the app's address and a link
  to the build; a follow that keeps waiting on a build after the call returned
  and tells you once when the app is live or the build failed; and `/nimbus`,
  a pane listing your apps with status, address and open alert incidents. By
  themselves the mods call only the connector's read-only `wait_for_build`
  and `list_apps` tools; they make no other network request and keep nothing
  after the session. They appear in Claude Code (terminal, desktop Code tab,
  VS Code, mobile), not in a claude.ai chat. Built against Claude Code
  2.1.323; the mods API is early access, so a Claude Code update can stop the
  mods from loading, and the connector and skill keep working when it does.
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
one is preselected) and approve three kinds of access:

- **See your apps, builds, logs and variable names**
- **Deploy and rebuild apps**
- **Change variables and run commands**

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
