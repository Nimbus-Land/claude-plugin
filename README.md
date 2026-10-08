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
  set variables and run one-off commands.
- **The `nimbus-cli` skill** (`skills/nimbus-cli/`): teaches Claude the
  [`nimbus` CLI](https://nimbusland.ca) for work that needs your local project:
  `nimbus init`, `nimbus detect`, and deploying the working tree as it is on
  disk. It tells Claude to prefer the connector when it is connected, and never
  to print or store your credentials.

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

Until Nimbus Land is listed in the Claude directory, add it as a custom
connector:

1. Open **Settings → Connectors → Add custom connector**.
2. Name it `Nimbus Land` and enter the URL `https://nimbusland.ca/mcp`. Leave
   the OAuth client fields empty.
3. Select **Connect** and sign in to Nimbus Land in the window that opens.

Once the connector is listed in the directory, install it from there instead.

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

The full guide, including every tool, the limits, what is sent to Anthropic
and the OAuth/MCP protocol details, is [docs/connector.md](docs/connector.md).
Questions or problems: support@nimbusland.ca.

## License

MIT. Copyright (c) 2026 102238904 Saskatchewan Inc. See [LICENSE](LICENSE).
