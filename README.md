# bot-observer

Structured JSON event logging and crash reporting for Discord.js bots, delivered straight to your DMs.

## What it does

bot-observer instruments your Discord.js bot to emit structured log events — command usage, errors, latency, crashes — and delivers them as formatted Discord embeds to a private DM channel. No external services, no dashboard, no database. Just your bot talking to you directly.

## Features

- Command usage tracking with latency
- Error and exception reporting with stack traces
- Crash detection via `uncaughtException` and `unhandledRejection` hooks
- Color-coded Discord embeds by severity
- Rate-limit-safe event queue (1s flush interval)
- DM channel cached on startup to avoid repeated API calls

## Event types

| Event | Trigger | Embed color |
|---|---|---|
| `startup` | Bot comes online | Green |
| `command_used` | Any command invoked | Blue |
| `slow_response` | Latency exceeds threshold | Yellow |
| `error` | Caught exception | Orange |
| `crash` | Uncaught exception / unhandled rejection | Red |

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure

Create a `.env` file in the project root:

```env
DISCORD_TOKEN=your_bot_token_here
LOG_USER_ID=your_discord_user_id
SLOW_RESPONSE_MS=2000
```

`LOG_USER_ID` is your personal Discord user ID — the bot will open a DM with you on startup and send all logs there.

### 3. Add to your bot

```js
import { bot-observer } from './bot-observer.js'

const bot-observer = new bot-observer(client)
await bot-observer.init()
```

## Usage

### Log a command

```js
const start = Date.now()

// your command logic...

bot-observer.log({
  event: 'command_used',
  command: interaction.commandName,
  guild: interaction.guild?.name,
  user: interaction.user.tag,
  latency_ms: Date.now() - start
})
```

### Log an error

```js
try {
  // your logic...
} catch (err) {
  bot-observer.log({
    event: 'error',
    command: 'commandName',
    message: err.message,
    stack: err.stack
  })
}
```

### Crash reporting

Crash hooks are registered automatically on `bot-observer.init()`. No extra setup needed.

```js
// Handled automatically — logs then exits cleanly
process.on('uncaughtException', ...)
process.on('unhandledRejection', ...)
```

## Log payload schema

Every event posted to the backend follows this shape:

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
├── bot-observer.js        # Core logger class
├── queue.js         # Rate-limit-safe event queue
├── embeds.js        # Discord embed formatters
├── index.js         # Example bot entry point
├── .env.example
└── README.md
```

## Limitations

- bot-observer cannot detect a hard process kill (`SIGKILL`) or an OOM termination — only graceful crashes via the Node.js exception hooks
- DM channels are subject to Discord's standard rate limits (5 req/s). The built-in queue handles normal error bursts, but a catastrophic crash loop may still get throttled before all events land

## License

MIT