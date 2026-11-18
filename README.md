# Nimbus Land for Claude

Put what you build with Claude on the web, hosted in Canada. Connect
[Nimbus Land](https://nimbusland.ca) once, then say:

> **Deploy this to Nimbus Land**

Claude works out what your app is built with, builds it and answers with its
address. After that, "is my app up?", "why did the last build fail?" and "add
a title and redeploy" are answered from your actual apps, in the same
conversation.

## Install

Pick the block for where you use Claude. One sign-in to Nimbus Land serves all
of them, and you can create your account in the same window.

**In Claude Code.** Install the Nimbus Land plugin: the connector plus a skill that teaches Claude how to deploy your project.

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

Then run `/mcp` and choose **nimbus** to sign in.

## What is in this plugin

- **The Nimbus Land connector** (`.mcp.json`): a remote MCP server at
  `https://nimbusland.ca/mcp`. You sign in with your Nimbus Land account and
  choose which organization Claude may act in. It deploys a small app
  straight from the conversation, a React artifact as it is, or the project
  on your disk through a one-time upload that Claude runs as one command,
  with no CLI to install and no second sign-in. It also lets Claude list
  apps, read status, runtime logs, builds and build logs, read environment
  variables (secret values masked), rebuild, set variables, run one-off
  commands, and read an app's health: open incidents, request figures,
  visitors, browser vitals, error groups with their stack traces and traces.
- **The `nimbus-cli` skill** (`skills/nimbus-cli/`): teaches Claude to deploy
  through the connector, to ask you to sign in when you have not yet (`/mcp`
  in Claude Code, **Connect** in a chat), and when the [`nimbus` CLI](https://nimbusland.ca) is the right tool
  instead (CI, a project over 100 MiB, or when you ask for it). It also
  covers what a deployable app looks like, and never printing or storing
  your credentials.

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

## What the consent screen asks

Nimbus Land shows which client is asking (for example "Claude") and where it
will send you back, then names the organization Claude will act in (you pick
one if you belong to several) and asks you to approve these kinds of access:

- **See your apps, builds, logs and variable names**
- **Deploy and rebuild apps**
- **Change environment variables and run one-off commands**
- **See your managed databases and their status**
- **Run read-only queries against your managed databases**
- **Create storage for your apps** (a volume, so an app's data survives
  deploys and restarts; Claude gives the price and asks first)

If your organization is in its free trial, the page says the trial covers the
deploy and that no card is needed.

Claude can never do more than your role in that organization allows. When the
request comes from Claude Code, the page warns that the sign-in returns to a
program on your own computer (`localhost`): only approve it if you just started
it yourself. To use a second organization, connect again and choose it.

## Revoking access

In the Nimbus Land console, open **Account settings → Connected apps** and
revoke the grant. Claude's next request is refused. Organization owners and
admins can also see and revoke members' grants under **Organization settings**.

## Good to know

- "Deploy this to Nimbus Land" takes up to 500 files and 1 MiB from a chat,
  and up to 100 MiB from a project folder in Claude Code. An app that already
  builds from a Git repository can keep deploying from it.
- New here? A new account starts with a free trial, no card needed. If you
  signed up with an email and a password, confirm your address first: until
  then Claude tells you to open the link we emailed you, then to ask again.
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
