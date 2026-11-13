// The state contract of the plugin's mods: what the hooks module keeps in
// `$.state` for the session. Nothing here outlives the session.

export type Outcome = 'pending' | 'live' | 'failed'

// Whether the plugin itself is waiting on the build: `on` while it does,
// `timed-out` after ten minutes, `lost` when the connector stopped answering.
export type Follow = 'none' | 'on' | 'timed-out' | 'lost'

export type Build = {
  id: string
  app: string
  outcome: Outcome
  follow: Follow
  followUntil: number
  hasToasted: boolean
  startedAt: number
  seenAt: number
  finishedAt: number
  liveUrl: string
  consoleUrl: string
  appConsoleUrl: string
  reason: string
  logTail: string[]
}

export type Builds = {
  byId: Record<string, Build>
  // tool_use_id of a deploy call's row -> the build its card shows
  byCall: Record<string, string>
}

export type AppRow = {
  name: string
  status: string
  url: string
  consoleUrl: string
  incidents: string[]
}

export type Apps = {
  state: 'idle' | 'ready' | 'disconnected'
  organization: string
  rows: AppRow[]
  fetchedAt: number
  note: string
}

declare module 'claude-code' {
  interface PluginState {
    'nimbus-land': {
      builds: Shaped<Builds>
      apps: Shaped<Apps>
      server: Shaped<string>
    }
  }
}
