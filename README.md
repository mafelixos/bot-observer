# bot-observer

Structured event logging and crash reporting for Discord.js bots, delivered straight to your DMs.

## What it does

bot-observer piggybacks on your bot's existing Discord client to send structured log events — command usage, errors, latency spikes, crashes — as formatted embeds to a private DM channel. One login, no external services, no database.

If your bot crashes before it ever logs in, bot-observer spins up a temporary client using the same token, sends the crash report, and tears it back down. You get notified either way.

## Features

- Hooks into your existing client — no second login in normal operation
- Early crash detection before `client.login()` is ever called
- Fallback emergency login for pre-startup failures
- Color-coded embeds by event severity
- Rate-limit-safe queue with 1s flush interval
- DM channel cached on startup

## Event types

| Event | Trigger | Color |
|---|---|---|
| `startup` | Bot comes online | Green |
| `command_used` | Any slash command invoked | Blue |
| `slow_response` | Latency exceeds threshold | Yellow |
| `error` | Caught exception | Orange |
| `crash` | Uncaught exception / unhandled rejection | Red |

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure

```env
DISCORD_TOKEN=your_bot_token_here
LOG_USER_ID=your_discord_user_id
SLOW_RESPONSE_MS=2000
```

`LOG_USER_ID` is your personal Discord user ID. The bot will open a DM with you on startup and deliver all logs there.

### 3. Add to your bot

Import bot-observer **at the very top of your entry point**, before anything else. This is what enables pre-startup crash detection.

```js
import { botObserver } from './bot-observer.js'

// ... rest of your bot setup ...

await client.login(TOKEN)
await botObserver.init(client)
```

That's it. Crash hooks are registered the moment the import runs. `init()` hands bot-observer your live client so it can borrow it for all subsequent logging.

## Usage

### Log a command

```js
const start = Date.now()

// your command logic...

botObserver.log({
  event: 'command_used',
  command: interaction.commandName,
  guild: interaction.guild?.name,
  user: interaction.user.tag,
  latency_ms: Date.now() - start
})
```

### Log a slow response

```js
const latency = Date.now() - start

if (latency > SLOW_MS) {
  botObserver.log({
    event: 'slow_response',
    command: interaction.commandName,
    latency_ms: latency
  })
}
```

### Log an error

```js
try {
  // your logic...
} catch (err) {
  botObserver.log({
    event: 'error',
    command: interaction.commandName,
    message: err.message,
    stack: err.stack
  })
}
```

### Crash reporting

Registered automatically on import. No setup needed.

Uncaught exceptions log the crash and exit. Unhandled rejections log the crash and keep the process alive.

## Payload schema

All fields except `event` are optional and only appear in the embed if provided.

```json
{
  "event": "error",
  "timestamp": "2026-06-06T14:23:01Z",
  "command": "play",
  "guild": "My Server",
  "user": "someuser#1234",
  "message": "Cannot read properties of undefined",
  "stack": "TypeError: Cannot read properties of undefined\n    at ..."
}
```

## Project structure

```
bot-observer/
├── bot-observer.js   # BotObserver class, Queue, embed builder
├── .env.example
└── README.md
```

## Limitations

- Cannot detect `SIGKILL` or OOM termination — only graceful crashes via Node.js exception hooks
- If the emergency login itself fails (bad token, no network), the crash report is lost
- DM channels are subject to Discord's rate limits. The built-in queue handles normal bursts, but a crash loop may be throttled before all events land

## License

MIT