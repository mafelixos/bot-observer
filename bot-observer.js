import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import 'dotenv/config'
import 'json'

const TOKEN        = process.env.DISCORD_TOKEN
const LOG_USER_ID  = process.env.LOG_USER_ID
const SLOW_MS      = parseInt(process.env.SLOW_RESPONSE_MS ?? '2000')

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})


class bot-observer {
  #dmChannel = null
  #queue     = []
  #flushing  = false

  async init() {
    const user = await client.users.fetch(LOG_USER_ID)
    this.#dmChannel = await user.createDM()

    process.on('uncaughtException', async (err) => {
      await this.log({
        event:   'crash',
        message: err.message,
        stack:   err.stack
      })
      process.exit(1)
    })

    process.on('unhandledRejection', async (reason) => {
      await this.log({
        event:   'crash',
        message: String(reason),
        stack:   reason?.stack ?? null
      })
    })
  }

  log(payload) {
    const entry = {
      ...payload,
      timestamp: new Date().toISOString()
    }

    this.#queue.push(entry)
    this.#scheduleFlush()
  }

  #scheduleFlush() {
    if (this.#flushing) return
    this.#flushing = true

    setTimeout(async () => {
      const batch = this.#queue.splice(0, this.#queue.length)

      for (const entry of batch) {
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

const COLORS = {
  startup:      0x57f287, // green
  command_used: 0x5865f2, // blurple
  slow_response:0xfee75c, // yellow
  error:        0xe67e22, // orange
  crash:        0xed4245, // red
}

function buildEmbed(entry) {
  const color = COLORS[entry.event] ?? 0x99aab5

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(entry.event.replace(/_/g, ' '))
    .setTimestamp(new Date(entry.timestamp))

  if (entry.message)  embed.setDescription(entry.message)
  if (entry.command)  embed.addFields({ name: 'Command',  value: entry.command,           inline: true })
  if (entry.guild)    embed.addFields({ name: 'Guild',    value: entry.guild,             inline: true })
  if (entry.user)     embed.addFields({ name: 'User',     value: entry.user,              inline: true })
  if (entry.latency_ms !== undefined)
                      embed.addFields({ name: 'Latency',  value: `${entry.latency_ms}ms`, inline: true })

  if (entry.stack) {
    const trimmed = entry.stack.slice(0, 1000)
    embed.addFields({ name: 'Stack trace', value: `\`\`\`\n${trimmed}\n\`\`\`` })
  }

  return embed
}