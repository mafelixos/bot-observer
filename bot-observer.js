import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import 'dotenv/config'

const TOKEN       = process.env.DISCORD_TOKEN
const LOG_USER_ID = process.env.LOG_USER_ID
const SLOW_MS     = parseInt(process.env.SLOW_RESPONSE_MS ?? '2000')

// ─── Embed builder ───────────────────────────────────────────────────────────

const COLORS = {
  startup:       0x57f287,
  command_used:  0x5865f2,
  slow_response: 0xfee75c,
  error:         0xe67e22,
  crash:         0xed4245,
}

function buildEmbed(entry) {
  const color = COLORS[entry.event] ?? 0x99aab5

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(entry.event.replace(/_/g, ' '))
    .setTimestamp(new Date(entry.timestamp))

  if (entry.message) embed.setDescription(entry.message)
  if (entry.command) embed.addFields({ name: 'Command',  value: entry.command,            inline: true })
  if (entry.guild)   embed.addFields({ name: 'Guild',    value: entry.guild,              inline: true })
  if (entry.user)    embed.addFields({ name: 'User',     value: entry.user,               inline: true })
  if (entry.latency_ms !== undefined)
                     embed.addFields({ name: 'Latency',  value: `${entry.latency_ms}ms`,  inline: true })
  if (entry.stack) {
    const trimmed = entry.stack.slice(0, 1000)
    embed.addFields({ name: 'Stack trace', value: `\`\`\`\n${trimmed}\n\`\`\`` })
  }

  return embed
}

// ─── Queue ───────────────────────────────────────────────────────────────────

class Queue {
  #dmChannel = null
  #queue     = []
  #flushing  = false

  setChannel(channel) {
    this.#dmChannel = channel
  }

  push(payload) {
    this.#queue.push({ ...payload, timestamp: new Date().toISOString() })
    this.#scheduleFlush()
  }

  #scheduleFlush() {
    if (this.#flushing) return
    this.#flushing = true

    setTimeout(async () => {
      const batch = this.#queue.splice(0, this.#queue.length)

      for (const entry of batch) {
        if (!this.#dmChannel) {
          console.error('[bot-observer] no DM channel yet, dropping:', entry)
          continue
        }
        try {
          await this.#dmChannel.send({ embeds: [buildEmbed(entry)] })
        } catch (err) {
          console.error('[bot-observer] failed to send log:', err.message)
        }
      }

      this.#flushing = false
      if (this.#queue.length > 0) this.#scheduleFlush()
    }, 1000)
  }
}

// ─── Observer ────────────────────────────────────────────────────────────────

class BotObserver {
  #queue = new Queue()

  constructor() {
    // Registered immediately on import — catches errors before init() is called
    process.on('uncaughtException', async (err) => {
      this.#queue.push({ event: 'crash', message: err.message, stack: err.stack })
      await this.#emergencyFlush()
      process.exit(1)
    })

    process.on('unhandledRejection', async (reason) => {
      this.#queue.push({
        event:   'crash',
        message: String(reason),
        stack:   reason?.stack ?? null
      })
      await this.#emergencyFlush()
    })
  }

  // Called by the user after client.login() succeeds
  async init(client) {
    const user     = await client.users.fetch(LOG_USER_ID)
    const channel  = await user.createDM()
    this.#queue.setChannel(channel)

    this.log({ event: 'startup' })
  }

  log(payload) {
    this.#queue.push(payload)
  }

  // If init() was never reached, spin up a throwaway client just to send the DM
  async #emergencyFlush() {
    if (this.#queue.#dmChannel) return // normal client is available, queue handles it

    const throwaway = new Client({ intents: [GatewayIntentBits.Guilds] })
    try {
      await throwaway.login(TOKEN)
      const user    = await throwaway.users.fetch(LOG_USER_ID)
      const channel = await user.createDM()
      this.#queue.setChannel(channel)
      await this.#queue.flush?.()
    } catch (err) {
      console.error('[bot-observer] emergency flush failed:', err.message)
    } finally {
      await throwaway.destroy()
    }
  }
}

export const botObserver = new BotObserver()