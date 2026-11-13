// The Nimbus Land plugin's mods: a card under each deploy call, a follow that
// waits on a started build, and the `/nimbus` apps pane.
//
// Everything here goes through the connector the session is signed in to. By
// itself the module calls two of its read-only tools, `wait_for_build` and
// `list_apps`, and nothing else: no network, file, process or stored value.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AppRow, Apps, Build, Builds, Outcome } from '../types'

const PANE = 'nimbus-apps'
const PANE_TITLE = 'Nimbus Land'
const PLUGIN_SERVER = 'nimbus'
const DIRECTORY_SERVER = 'claude.ai Nimbus Land'
const DEPLOY_TOOL =
  /^mcp__(.+)__(deploy_source|deploy_app|rebuild|wait_for_build)$/
const FOLLOW_MS = 10 * 60_000
const FOLLOW_GAP_MS = 5_000
const REFRESH_MS = 60_000
const LOG_TAIL = 12
const KEPT_BUILDS = 50
const CONNECT_LINE =
  'Not connected to Nimbus Land. Run /mcp and choose Nimbus Land to sign in.'

// Change a tag when its value's fields change: it declines what an earlier
// version of this module stored, which outlives a reload.
const NO_BUILDS: Builds = { byId: {}, byCall: {} }
const NO_APPS: Apps = {
  state: 'idle',
  organization: '',
  rows: [],
  fetchedAt: 0,
  note: '',
}
const builds = atom({ plugin: 'nimbus-land', key: 'builds' } as const, NO_BUILDS, {
  shape: 'builds-1',
})
const apps = atom({ plugin: 'nimbus-land', key: 'apps' } as const, NO_APPS, {
  shape: 'apps-1',
})
const server = atom({ plugin: 'nimbus-land', key: 'server' } as const, '', {
  shape: 'server-1',
})

type Engine = EngineInterface
type Fields = Record<string, unknown>
type Seen = {
  id: string
  app: string
  outcome: Outcome
  liveUrl: string
  consoleUrl: string
  appConsoleUrl: string
  reason: string
  logTail: string[]
  startedAt: number
  completedAt: number
}

// The module's own memory: lost on a reload, rebuilt at `session.start`.
const following = new Set<string>()
let refreshTimer: { cancel: () => void } | undefined

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const text = (value: unknown): string =>
  typeof value === 'string' ? value : ''

const time = (value: unknown): number => {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN

  return Number.isFinite(ms) ? ms : 0
}

// The connector answers each tool with its fields as JSON: a `tool.call`
// result carries that JSON as a string, `$.mcp.call` as its first text block.
function fieldsOf(value: unknown): Fields | undefined {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)

      return isRecord(parsed) ? parsed : undefined
    } catch {
      return undefined
    }
  }
  if (!isRecord(value)) return undefined
  if (isRecord(value.structuredContent)) return value.structuredContent
  if (Array.isArray(value.content)) {
    for (const block of value.content) {
      const found = isRecord(block) ? fieldsOf(text(block.text)) : undefined
      if (found) return found
    }

    return undefined
  }

  return value
}

// A Nimbus Land build record, or nothing: another server's tool of the same
// name answers something else and is left alone.
function buildOf(fields: Fields | undefined): Seen | undefined {
  if (!fields) return undefined
  const id = text(fields.build_id) || text(fields.id)
  const app = text(fields.app_name)
  const status = text(fields.status)
  const consoleUrl = text(fields.console_url)
  if (!id || !app || !status || !consoleUrl) return undefined

  const said = fields.outcome
  const outcome: Outcome =
    said === 'live' || said === 'failed' || said === 'pending'
      ? said
      : status === 'failed'
        ? 'failed'
        : 'pending'
  const lines = Array.isArray(fields.log_lines) ? fields.log_lines : []

  return {
    id,
    app,
    outcome,
    liveUrl: text(fields.live_url),
    consoleUrl,
    appConsoleUrl: text(fields.app_console_url) || text(fields.app_url),
    reason: text(fields.failure_reason),
    logTail: lines.filter(line => typeof line === 'string').slice(-LOG_TAIL),
    startedAt: time(fields.started_at) || time(fields.created_at),
    completedAt: time(fields.completed_at),
  }
}

function appsOf(fields: Fields | undefined): AppRow[] | undefined {
  if (!fields || !Array.isArray(fields.apps)) return undefined

  return fields.apps.filter(isRecord).map(app => ({
    name: text(app.name),
    status: text(app.status),
    url: text(app.url),
    consoleUrl: text(app.console_url),
    incidents: Array.isArray(app.open_incidents)
      ? app.open_incidents.filter(one => typeof one === 'string')
      : [],
  }))
}

const needsAttention = (app: AppRow): number =>
  app.incidents.length > 0 ? 0 : /error|failed|degraded/.test(app.status) ? 1 : 2

const duration = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))

  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

const clock = (ms: number): string => {
  const at = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')

  return `${two(at.getHours())}:${two(at.getMinutes())}`
}

// The engine heads a status line and a toast with the plugin's name, so
// neither text repeats it.
function showStatus($: Engine, state: Builds): void {
  const pending = Object.values(state.byId).filter(
    build => build.outcome === 'pending' && build.follow === 'on',
  )
  const first = pending[0]

  $.ui.status(
    first === undefined
      ? undefined
      : pending.length === 1
        ? `building ${first.app}`
        : `building ${pending.length} apps`,
  )
}

// Records what a connector call said about a build. The one place a build
// settles, whoever asked (Claude's call or the follow), so its toast is
// raised once.
async function record(
  $: Engine,
  seen: Seen,
  from: { callId?: string; startedAt?: number; canFollow: boolean },
): Promise<void> {
  const now = await $.clock.now()
  let toast = ''
  let shouldFollow = false

  const state = await update($, builds, held => {
    const before = held.byId[seen.id]
    const wasPending = before === undefined || before.outcome === 'pending'
    const isSettling = wasPending && seen.outcome !== 'pending'
    const wasFollowed = before !== undefined && before.follow !== 'none'
    shouldFollow =
      from.canFollow && seen.outcome === 'pending' && before === undefined
    toast =
      isSettling && wasFollowed && !before.hasToasted
        ? seen.outcome === 'live'
          ? `${seen.app} is live${seen.liveUrl ? ` at ${seen.liveUrl}` : ''}`
          : `the build of ${seen.app} failed`
        : ''

    // A build that has settled stays settled: a late "still going" answer
    // changes nothing but when it was last seen.
    const next: Build = !wasPending
      ? { ...before, seenAt: now }
      : {
          id: seen.id,
          app: seen.app,
          outcome: seen.outcome,
          follow: shouldFollow
            ? 'on'
            : isSettling && wasFollowed
              ? 'none'
              : (before?.follow ?? 'none'),
          followUntil: before?.followUntil ?? (shouldFollow ? now + FOLLOW_MS : 0),
          hasToasted: (before?.hasToasted ?? false) || toast !== '',
          startedAt:
            before?.startedAt ?? (from.startedAt || seen.startedAt || now),
          seenAt: now,
          finishedAt:
            seen.outcome === 'pending'
              ? 0
              : before === undefined && !from.startedAt && seen.completedAt
                ? seen.completedAt
                : now,
          liveUrl: seen.liveUrl || (before?.liveUrl ?? ''),
          consoleUrl: seen.consoleUrl,
          appConsoleUrl: seen.appConsoleUrl || (before?.appConsoleUrl ?? ''),
          reason: seen.reason,
          logTail: seen.logTail,
        }

    const byId = { ...held.byId, [seen.id]: next }
    const byCall =
      from.callId === undefined
        ? held.byCall
        : { ...held.byCall, [from.callId]: seen.id }
    const dropped = Object.values(byId)
      .sort((a, b) => b.seenAt - a.seenAt)
      .slice(KEPT_BUILDS)
      .map(build => build.id)
    for (const id of dropped) delete byId[id]

    return {
      byId,
      byCall: Object.fromEntries(
        Object.entries(byCall).filter(([, id]) => byId[id] !== undefined),
      ),
    }
  })

  if (toast) $.ui.toast(toast, { timeoutMs: 8000 })
  showStatus($, state)
  if (shouldFollow) follow($, seen.id)
  if (from.canFollow || toast) void refreshWhilePlaced($)
}

async function stopFollowing(
  $: Engine,
  id: string,
  why: 'timed-out' | 'lost',
): Promise<void> {
  following.delete(id)
  const state = await update($, builds, held => {
    const build = held.byId[id]

    return build === undefined || build.outcome !== 'pending'
      ? held
      : { ...held, byId: { ...held.byId, [id]: { ...build, follow: why } } }
  })
  showStatus($, state)
}

// Waits on a build this session started, with the connector's read-only
// `wait_for_build`, until it settles, the connector stops answering, or ten
// minutes have passed.
function follow($: Engine, id: string): void {
  if (following.has(id)) return
  following.add(id)
  $.clock.after(FOLLOW_GAP_MS, () => void followStep($, id))
}

async function followStep($: Engine, id: string): Promise<void> {
  try {
    const build = (await read($, builds)).byId[id]
    if (!build || build.outcome !== 'pending' || build.follow !== 'on') {
      following.delete(id)
      return
    }
    if ((await $.clock.now()) >= build.followUntil) {
      return await stopFollowing($, id, 'timed-out')
    }

    const name = await read($, server)
    const answer = await $.mcp.call(name, 'wait_for_build', { id })
    const seen = answer.isError ? undefined : buildOf(fieldsOf(answer))
    if (!seen || seen.id !== id) return await stopFollowing($, id, 'lost')

    await record($, seen, { canFollow: false })
    if (seen.outcome === 'pending') {
      $.clock.after(FOLLOW_GAP_MS, () => void followStep($, id))
    } else {
      following.delete(id)
    }
  } catch {
    await stopFollowing($, id, 'lost').catch(() => {})
  }
}

// The connector's name in this session: the one a deploy call was seen on,
// else the plugin's own, else the directory's. The `connector` option names
// another (a local control plane under development).
async function candidates($: Engine, option: string): Promise<string[]> {
  const names = [option, await read($, server)]
  try {
    const own = await $.mcp.connect(PLUGIN_SERVER)
    if (own.isConnected) names.push(own.server)
  } catch {
    // No server of the plugin's own in this session: the directory's is next.
  }
  names.push(DIRECTORY_SERVER)

  return [...new Set(names.filter(name => name !== ''))]
}

async function refresh($: Engine, option: string): Promise<Apps> {
  const now = await $.clock.now()
  let note = ''

  for (const name of await candidates($, option)) {
    try {
      const answer = await $.mcp.call(name, 'list_apps', {})
      const fields = fieldsOf(answer)
      const rows = answer.isError ? undefined : appsOf(fields)
      if (rows && fields) {
        await update($, server, () => name)
        const organization = text(fields.organization)

        return update($, apps, () => ({
          state: 'ready',
          organization,
          rows: rows.sort(
            (a, b) =>
              needsAttention(a) - needsAttention(b) ||
              a.name.localeCompare(b.name),
          ),
          fetchedAt: now,
          note: '',
        }))
      }
      // The connector answered and refused (a permission, say): its own
      // sentence is worth more than a guess.
      const said = answer.content.find(block => block.type === 'text')?.text
      note = note || text(said).split('\n')[0]!.slice(0, 200)
    } catch {
      // Not a server of this session: try the next name.
    }
  }

  return update($, apps, () => ({
    state: 'disconnected',
    organization: '',
    rows: [],
    fetchedAt: now,
    note,
  }))
}

const isPanePlaced = async ($: Engine): Promise<boolean> =>
  (await $.ui.panes()).some(pane => pane.id === PANE && pane.isPlaced)

let connectorOption = ''

async function refreshWhilePlaced($: Engine): Promise<void> {
  try {
    if (await isPanePlaced($)) await refresh($, connectorOption)
  } catch {
    // A refresh that fails leaves the pane as it was.
  }
}

// One refresh a minute, only while a surface shows the pane.
function keepFresh($: Engine): void {
  refreshTimer?.cancel()
  const timer = $.clock.every(REFRESH_MS, () => {
    void isPanePlaced($)
      .then(isPlaced => {
        if (isPlaced) return refresh($, connectorOption)
        timer.cancel()
        if (refreshTimer === timer) refreshTimer = undefined
      })
      .catch(() => {})
  })
  refreshTimer = timer
}

function listing(state: Apps): string {
  if (state.state !== 'ready') return CONNECT_LINE
  if (state.rows.length === 0) {
    return `No apps in ${state.organization || 'this organization'} yet.`
  }

  return state.rows
    .map(app =>
      [
        app.name,
        app.incidents.length > 0 ? `incident: ${app.incidents.join(', ')}` : '',
        app.status,
        app.url,
      ]
        .filter(part => part !== '')
        .join(' · '),
    )
    .join('\n')
}

type Call = {
  tool: string
  tool_use_id?: string
  input: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
  output?: unknown
}
type Elements = Pick<ReturnType<Engine['ui']['resolve']>, 'Box' | 'Text' | 'Link'>

// The card's lines for one connector deploy call, or nothing when the call
// is not one, was refused, or answered something that is no build.
async function cardLines($: Engine, { Text, Link }: Elements, call: Call) {
  const match = DEPLOY_TOOL.exec(call.tool)
  if (!match || call.isErrored || call.isInterrupted) return undefined

  const state = await read($, builds)
  const args = isRecord(call.input) ? call.input : {}
  const known = state.byId[state.byCall[call.tool_use_id ?? ''] ?? text(args.id)]

  if (call.isRunning) {
    // Before the result there is no shape to check: the card is drawn only
    // for a server this session knows as Nimbus Land's.
    const isOurs =
      match[1] === (await read($, server)) || /nimbus/i.test(match[1] ?? '')
    const app = known?.app || text(args.name) || text(args.app)
    if (!isOurs || !app) return undefined

    return [
      <Text>
        <Text weight="bold">{app}</Text> · <Text color="warning">Building</Text>
      </Text>,
    ]
  }

  // A row drawn again after a reload or a resume has no build in state: its
  // stored result says what it was.
  const fallback = known ? undefined : buildOf(fieldsOf(call.output))
  const build = known ?? fallback
  if (!build) return undefined

  const followed = known?.follow ?? 'none'
  const took =
    known === undefined
      ? fallback && fallback.startedAt > 0 && fallback.completedAt > fallback.startedAt
        ? duration(fallback.completedAt - fallback.startedAt)
        : ''
      : known.finishedAt > 0
        ? duration(known.finishedAt - known.startedAt)
        : ''
  const [word, color] =
    build.outcome === 'live'
      ? (['Live', 'success'] as const)
      : build.outcome === 'failed'
        ? (['Failed', 'error'] as const)
        : followed === 'timed-out'
          ? (['Still building after 10 minutes', 'warning'] as const)
          : (['Building', 'warning'] as const)

  return [
    <Text>
      <Text weight="bold">{build.app}</Text> · <Text color={color}>{word}</Text>
      {took ? ` · ${took}` : ''}
    </Text>,
    build.outcome === 'live' && build.liveUrl !== '' && (
      <Link href={build.liveUrl}>{build.liveUrl}</Link>
    ),
    build.outcome === 'live' && build.liveUrl === '' && build.appConsoleUrl !== '' && (
      <Text dimColor>
        Address: on the app's page, <Link href={build.appConsoleUrl}>{build.appConsoleUrl}</Link>
      </Text>
    ),
    build.outcome === 'failed' && build.reason !== '' && <Text>{build.reason}</Text>,
    ...(build.outcome === 'failed'
      ? build.logTail.map(line => <Text dimColor>{line}</Text>)
      : []),
    followed === 'lost' && (
      <Text dimColor>The connector stopped answering; the console has the build.</Text>
    ),
    <Text dimColor>
      Build: <Link href={build.consoleUrl}>{build.consoleUrl}</Link>
    </Text>,
  ]
}

export const register: Register = (on, options) => {
  connectorOption = text(options.connector).trim()

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    try {
      await $.command.register({
        name: 'nimbus',
        description: 'Show your Nimbus Land apps in a pane',
      })
      // After a reload: pick up the builds still being followed, and the
      // pane's timer if the pane stayed up.
      const state = await read($, builds)
      for (const build of Object.values(state.byId)) {
        if (build.outcome === 'pending' && build.follow === 'on') {
          follow($, build.id)
        }
      }
      showStatus($, state)
      if (await isPanePlaced($)) keepFresh($)
    } catch {
      // The mods are an extra: a session starts without them.
    }

    return started
  })

  on('tool.call', { tool: DEPLOY_TOOL }, async ($, e, next) => {
    const startedAt = await $.clock.now().catch(() => 0)
    const ran = await next(e)
    try {
      const [, name = '', tool = ''] = DEPLOY_TOOL.exec(String(e.tool)) ?? []
      const seen =
        ran.deny === undefined && ran.isError !== true
          ? buildOf(fieldsOf(ran.result) ?? fieldsOf(ran.text))
          : undefined
      if (seen) {
        await update($, server, () => name)
        const isStart = tool !== 'wait_for_build'
        await record($, seen, {
          callId: e.tool_use_id,
          startedAt: isStart ? startedAt : 0,
          canFollow: isStart,
        })
      }
    } catch {
      // The call's result goes back to Claude whatever became of the card.
    }

    return ran
    // Not a guard: when this hook fails, the call goes on as Claude made it.
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse', props: { tool: DEPLOY_TOOL } }, async ($, e, next) => {
    const row = await next(e)
    const lines = await cardLines($, $.ui.resolve(e), e.props)
    if (!lines) return row
    const { Box } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
        {row}
        {lines}
      </Box>
    )
  })

  // Connector calls are usually folded into one "Called ..." line: the cards
  // of its deploy calls go under that line, so the address shows unexpanded.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const group = await next(e)
    if (e.props.isExpanded) return group
    const ui = $.ui.resolve(e)
    const cards = []
    for (const call of e.props.calls) {
      const lines = await cardLines($, ui, call)
      if (lines) cards.push(lines)
    }
    if (cards.length === 0) return group
    const { Box } = ui

    // A group of deploy calls alone is one card with its line inside, which a
    // mobile app shows without a tap.
    if (cards.length === e.props.calls.length) {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
          {group}
          {cards}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {group}
        {cards.map(lines => (
          <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
            {lines}
          </Box>
        ))}
      </Box>
    )
  })

  on('command.run', { command: 'nimbus' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: PANE_TITLE })
    const state = await refresh($, connectorOption)
    if (!opened.isPlaced) return { text: listing(state) }
    keepFresh($)

    return { text: 'Nimbus Land apps pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Link } = $.ui.resolve(e)
    const state = await read($, apps)

    if (state.state === 'idle') {
      return (
        <Box flexDirection="column">
          <Text dimColor>Loading your apps...</Text>
        </Box>
      )
    }
    if (state.state === 'disconnected') {
      return (
        <Box flexDirection="column">
          <Text>{CONNECT_LINE}</Text>
          {state.note !== '' && <Text dimColor>{state.note}</Text>}
        </Box>
      )
    }

    const room = Math.max(1, (e.viewport?.rows ?? 24) - 5)
    const shown = state.rows.slice(0, room)
    const hidden = state.rows.length - shown.length
    const where = state.organization || 'this organization'

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {state.rows.length === 1 ? '1 app' : `${state.rows.length} apps`} in {where} ·
          refreshed {clock(state.fetchedAt)}
        </Text>
        {state.rows.length === 0 && (
          <Text>
            No apps yet. Ask Claude to deploy this project to Nimbus Land.
          </Text>
        )}
        {shown.map(app => (
          <Box flexDirection="column">
            <Text>
              {app.incidents.length > 0 && (
                <Text color="error">! {app.incidents.join(', ')} </Text>
              )}
              <Text weight="bold">{app.name}</Text> <Text dimColor>{app.status}</Text>
            </Text>
            {app.url !== '' && <Link href={app.url}>{app.url}</Link>}
          </Box>
        ))}
        {hidden > 0 && <Text dimColor>and {hidden} more</Text>}
      </Box>
    )
  })
}
