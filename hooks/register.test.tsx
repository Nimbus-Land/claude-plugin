import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BUILD = {
  id: 'b1',
  build_id: 'b1',
  app_name: 'shop',
  status: 'succeeded',
  console_url: 'https://nimbusland.ca/builds/b1',
  started_at: '2026-11-12T10:00:00Z',
  completed_at: '2026-11-12T10:00:40Z',
}
const LIVE = {
  ...BUILD,
  outcome: 'live',
  finished: true,
  live_url: 'https://shop.nimbusland.app',
  app_console_url: 'https://nimbusland.ca/apps/shop',
}
const PENDING = { ...BUILD, status: 'building', outcome: 'pending', finished: false }
const FAILED = {
  ...BUILD,
  status: 'failed',
  outcome: 'failed',
  finished: true,
  failure_reason: 'The build command exited with status 1.',
  log_lines: ['npm ERR! missing script: build', 'exit status 1'],
}
const DEPLOY = 'mcp__nimbus-local__deploy_source'
const WAIT = 'mcp__nimbus-local__wait_for_build'
const SURFACES = ['terminal', 'desktop'] as const
// The person typing /nimbus at the prompt.
const NIMBUS = {
  command: 'nimbus',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

type World = {
  toasts: string[]
  status: (string | undefined)[]
  calls: { server: string; tool: string }[]
  ids: string[]
}

// Stands for the engine beneath the plugin: the connector's answers, and a
// record of what the plugin showed and called.
function world(
  on: On,
  answers: { tool?: (tool: string) => unknown; mcp?: (tool: string) => unknown },
): World {
  const seen: World = { toasts: [], status: [], calls: [], ids: [] }

  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'nimbus' } }))
  on('ui.toast', (_, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    seen.status.push(e.text)
    return { value: undefined }
  })
  on('tool.call', (_, e) => {
    seen.ids.push(e.tool_use_id)
    const answer = answers.tool?.(String(e.tool))
    return typeof answer === 'string' && answer.startsWith('Error')
      ? { result: answer, isError: true }
      : { result: JSON.stringify(answer) }
  })
  on('mcp.connect', () => ({
    value: { isConnected: false, reason: 'failed', message: 'not in this session' },
  }))
  on('mcp.call', (_, e) => {
    seen.calls.push({ server: e.server, tool: e.tool })
    const answer = answers.mcp?.(e.tool)
    if (answer === undefined) throw new Error(`no server named ${e.server}`)
    return typeof answer === 'string'
      ? { value: { content: [{ type: 'text', text: answer }], isError: true } }
      : { value: { content: [{ type: 'text', text: JSON.stringify(answer) }], isError: false } }
  })

  return seen
}

const row = (id: string, tool: string, more: Record<string, unknown> = {}) =>
  ({
    plugin: 'nimbus-land',
    component: 'ToolUse',
    requestId: id,
    props: {
      tool_use_id: id,
      tool,
      input: { name: 'shop' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      ...more,
    },
  }) as const

const PANE = {
  plugin: 'nimbus-land',
  component: 'Pane',
  requestId: 'nimbus-apps',
  props: {
    title: 'Nimbus Land',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

// The engine's own row, which every card keeps.
const engineRow = (on: On) =>
  on('ui.render', { component: 'ToolUse' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine row</Text>
  })

test('a deploy that goes live draws a Live card with the address', async ($, on) => {
  const seen = world(on, { tool: () => LIVE })
  mock.clock(on)
  engineRow(on)
  await $.tool.call({ tool: DEPLOY, name: 'shop' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...row(seen.ids[0]!, DEPLOY), surface })

    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /shop · Live/ })).toBeDefined()
    expect(await ui.find({ type: 'Link', text: /shop\.nimbusland\.app/ })).toBeDefined()
    expect(await ui.find({ type: 'Link', text: /builds\/b1/ })).toBeDefined()
    await ui.unmount()
  }
  expect(seen.toasts).toEqual([])
})

test('a failed build draws Failed with the log tail and the console link', async ($, on) => {
  const seen = world(on, { tool: () => FAILED })
  mock.clock(on)
  engineRow(on)
  await $.tool.call({ tool: DEPLOY, name: 'shop' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...row(seen.ids[0]!, DEPLOY), surface })

    expect(await ui.find({ type: 'Text', text: /shop · Failed/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /missing script: build/ })).toBeDefined()
    expect(await ui.find({ type: 'Link', text: /builds\/b1/ })).toBeDefined()
    await ui.unmount()
  }
})

test('while the call runs the card reads Building with the name from the arguments', async ($, on) => {
  world(on, {})
  engineRow(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...row('t-run', DEPLOY, { isRunning: true }), surface })

    expect(await ui.find({ type: 'Text', text: /shop · Building/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a refused call draws no card', async ($, on) => {
  const seen = world(on, { tool: () => 'Error: the name shop is taken.' })
  engineRow(on)
  await $.tool.call({ tool: DEPLOY, name: 'shop' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      ...row(seen.ids[0]!, DEPLOY, { isErrored: true, output: 'the name shop is taken.' }),
      surface,
    })

    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /shop ·/ })).toBeUndefined()
    await ui.unmount()
  }
})

test("another server's deploy_source is left alone", async ($, on) => {
  const foreign = { ok: true, deployment: 'd-9', url: 'https://example.com' }
  const seen = world(on, { tool: () => foreign })
  engineRow(on)
  await $.tool.call({ tool: 'mcp__other__deploy_source', name: 'shop' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      ...row(seen.ids[0]!, 'mcp__other__deploy_source', { output: JSON.stringify(foreign) }),
      surface,
    })

    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /shop ·/ })).toBeUndefined()
    await ui.unmount()
  }
  // Still running, on a server the session does not know as Nimbus Land's.
  const ui = await $.ui.mount({
    ...row('t-other', 'mcp__other__deploy_source', { isRunning: true }),
    surface: 'terminal',
  })
  expect(await ui.find({ type: 'Text', text: /Building/ })).toBeUndefined()
  await ui.unmount()
  expect(seen.calls).toEqual([])
})

test('deploy_app starts a build without an outcome: it is followed too', async ($, on) => {
  const { outcome: _, ...started } = PENDING
  const seen = world(on, { tool: () => started, mcp: () => LIVE })
  const clock = mock.clock(on)
  await $.tool.call({ tool: 'mcp__nimbus-local__deploy_app', name: 'shop' })
  await clock.advance(6_000)

  expect(seen.calls).toEqual([{ server: 'nimbus-local', tool: 'wait_for_build' }])
  expect(seen.toasts).toEqual(['shop is live at https://shop.nimbusland.app'])
})

test('a pending build is followed: status line, then one toast and a Live card', async ($, on) => {
  let waits = 0
  const seen = world(on, {
    tool: () => PENDING,
    mcp: () => (++waits < 3 ? PENDING : LIVE),
  })
  const clock = mock.clock(on)
  await $.tool.call({ tool: DEPLOY, name: 'shop' })

  expect(seen.status.at(-1)).toBe('building shop')
  expect(seen.toasts).toEqual([])

  await clock.advance(120_000)

  expect(seen.calls.map(call => call.tool)).toEqual([
    'wait_for_build',
    'wait_for_build',
    'wait_for_build',
  ])
  expect(seen.status.at(-1)).toBeUndefined()
  expect(seen.toasts).toEqual(['shop is live at https://shop.nimbusland.app'])

  const ui = await $.ui.mount({ ...row(seen.ids[0]!, DEPLOY), surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /shop · Live/ })).toBeDefined()
  await ui.unmount()
})

test("Claude's own wait_for_build settles the build first: still one toast", async ($, on) => {
  let outcome: unknown = PENDING
  const seen = world(on, { tool: () => outcome, mcp: () => LIVE })
  const clock = mock.clock(on)
  await $.tool.call({ tool: DEPLOY, name: 'shop' })

  outcome = LIVE
  await $.tool.call({ tool: WAIT, id: 'b1' })
  await clock.advance(60_000)

  expect(seen.toasts).toEqual(['shop is live at https://shop.nimbusland.app'])
  expect(seen.calls).toEqual([])
  expect(seen.status.at(-1)).toBeUndefined()
})

test('after ten minutes the follow stops and the card says still building', async ($, on) => {
  const seen = world(on, { tool: () => PENDING, mcp: () => PENDING })
  const clock = mock.clock(on)
  await $.tool.call({ tool: DEPLOY, name: 'shop' })
  await clock.advance(11 * 60_000)

  const calls = seen.calls.length
  expect(seen.status.at(-1)).toBeUndefined()
  expect(seen.toasts).toEqual([])

  await clock.advance(5 * 60_000)
  expect(seen.calls.length).toBe(calls)

  const ui = await $.ui.mount({ ...row(seen.ids[0]!, DEPLOY), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Still building after 10 minutes/ })).toBeDefined()
  expect(await ui.find({ type: 'Link', text: /builds\/b1/ })).toBeDefined()
  await ui.unmount()
})

test('an error from the wait tool stops the follow without a toast', async ($, on) => {
  const seen = world(on, { tool: () => PENDING, mcp: () => 'Sign in again.' })
  const clock = mock.clock(on)
  await $.tool.call({ tool: DEPLOY, name: 'shop' })
  await clock.advance(60_000)

  expect(seen.calls).toEqual([{ server: 'nimbus-local', tool: 'wait_for_build' }])
  expect(seen.status.at(-1)).toBeUndefined()
  expect(seen.toasts).toEqual([])
})

test('a build Claude only waits on, from before this session, is not followed', async ($, on) => {
  const seen = world(on, { tool: () => PENDING, mcp: () => LIVE })
  const clock = mock.clock(on)
  await $.tool.call({ tool: WAIT, id: 'b1' })
  await clock.advance(60_000)

  expect(seen.calls).toEqual([])
  expect(seen.toasts).toEqual([])
})

const APPS = {
  organization: 'Acme',
  apps: [
    { name: 'blog', status: 'running', url: 'https://blog.nimbusland.app', open_incidents: [] },
    { name: 'shop', status: 'running', url: 'https://shop.nimbusland.app', open_incidents: ['Down'] },
  ],
}

test('/nimbus lists the apps, the one with an open incident first', async ($, on) => {
  const seen = world(on, { mcp: () => APPS })
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run(NIMBUS)

  // The plugin's own server is not in this session: the directory's answers.
  expect(seen.calls).toEqual([{ server: 'claude.ai Nimbus Land', tool: 'list_apps' }])

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const rows = await ui.findAll({ type: 'Text', text: /^(! Down )?(shop|blog) running$/ })

    expect(rows.map(one => one.text)).toEqual(['! Down shop running', 'blog running'])
    expect(await ui.find({ type: 'Text', text: /2 apps in Acme · refreshed \d\d:\d\d/ })).toBeDefined()
    expect(await ui.find({ type: 'Link', text: /shop\.nimbusland\.app/ })).toBeDefined()
    await ui.unmount()
  }
})

test('/nimbus with no apps says so and suggests a deploy', async ($, on) => {
  world(on, { mcp: () => ({ organization: 'Acme', apps: [] }) })
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  await $.command.run(NIMBUS)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Ask Claude to deploy this project/ })).toBeDefined()
  await ui.unmount()
})

test('/nimbus without a connector shows how to connect, and throws nothing', async ($, on) => {
  world(on, {})
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  const ran = await $.command.run(NIMBUS)

  expect(ran.text).toBe('Nimbus Land apps pane opened.')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Run \/mcp and choose Nimbus Land/ })).toBeDefined()
  await ui.unmount()
})

test('the connector option names the server to ask', { options: { connector: 'nimbus-local' } }, async ($, on) => {
  const seen = world(on, { mcp: () => APPS })
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no-surface' } }))
  on('ui.panes', () => ({ value: [] }))
  const ran = await $.command.run(NIMBUS)

  expect(seen.calls).toEqual([{ server: 'nimbus-local', tool: 'list_apps' }])
  // No surface shows a pane: the command answers with the list itself.
  expect(ran.text).toBe(
    'shop · incident: Down · running · https://shop.nimbusland.app\nblog · running · https://blog.nimbusland.app',
  )
})

test('the pane refreshes each minute only while it is placed', async ($, on) => {
  const seen = world(on, { mcp: () => APPS })
  const clock = mock.clock(on)
  let isPlaced = true
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({
    value: [{ id: 'nimbus-apps', title: 'Nimbus Land', isShown: isPlaced, isFocused: false, isPlaced }],
  }))
  await $.command.run(NIMBUS)
  expect(seen.calls.length).toBe(1)

  await clock.advance(125_000)
  expect(seen.calls.length).toBe(3)

  isPlaced = false
  await clock.advance(300_000)
  expect(seen.calls.length).toBe(3)
})

test('no pane opens when a session starts', async ($, on) => {
  const seen = world(on, { mcp: () => APPS })
  mock.clock(on)
  const opened: string[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: [] }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(opened).toEqual([])
  expect(seen.calls).toEqual([])
})

test('a folded group of calls shows the card under its line', async ($, on) => {
  const seen = world(on, { tool: () => LIVE })
  mock.clock(on)
  on('ui.render', { component: 'ToolGroup' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>Called nimbus-local</Text>
  })
  await $.tool.call({ tool: DEPLOY, name: 'shop' })
  const call = {
    tool_use_id: seen.ids[0]!,
    tool: DEPLOY,
    input: { name: 'shop' },
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
  }
  const read = { ...call, tool_use_id: 't-read', tool: 'Read', input: { file_path: '/a' } }

  for (const surface of SURFACES) {
    for (const calls of [[call], [read, call]]) {
      const ui = await $.ui.mount({
        plugin: 'nimbus-land',
        component: 'ToolGroup',
        requestId: 'g1',
        surface,
        props: { calls, isActive: false, isExpanded: false },
      })

      expect(await ui.find({ type: 'Text', text: /Called nimbus-local/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /shop · Live/ })).toBeDefined()
      expect(await ui.find({ type: 'Link', text: /shop\.nimbusland\.app/ })).toBeDefined()
      await ui.unmount()
    }
    // Expanded, each call is its own row with its own card: none on the group.
    const ui = await $.ui.mount({
      plugin: 'nimbus-land',
      component: 'ToolGroup',
      requestId: 'g1',
      surface,
      props: { calls: [call], isActive: false, isExpanded: true },
    })
    expect(await ui.find({ type: 'Text', text: /shop · Live/ })).toBeUndefined()
    await ui.unmount()
  }
})
