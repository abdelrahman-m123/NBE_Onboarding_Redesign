import crypto from 'crypto'
import { logger } from './logger.js'

// In-memory store
const appToChatId = new Map()
const otpStore = new Map()

const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutes
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

/**
 * Helper to dispatch message via Telegram API
 */
async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) return
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      logger.error('Telegram API error response:', data)
    }
  } catch (err) {
    logger.error('Failed to send Telegram message:', err.message)
  }
}

/**
 * Long-polling loop: Listens for incoming Telegram messages
 */
let lastUpdateId = 0
let isPolling = false

export async function startTelegramBotListener() {
  if (!BOT_TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN is missing in .env')
    return
  }

  if (isPolling) return
  isPolling = true

  logger.info('🤖 Telegram bot listener active and waiting for messages...')

  const poll = async () => {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`
      )
      const data = await response.json()

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id

          const text = update.message?.text || ''
          const chatId = update.message?.chat?.id

          if (chatId) {
            logger.info(`📩 Received message from Telegram chat ${chatId}: "${text}"`)

            // Extract application ID if provided, otherwise default to active session
            const parts = text.split(' ')
            const targetAppId = parts[1]?.trim() || 'demo_app'

            appToChatId.set(targetAppId, chatId)
            appToChatId.set('latest', chatId) // Stores the most recent user chat

            // Generate OTP
            const otpCode = crypto.randomInt(100000, 999999).toString()
            otpStore.set(targetAppId, {
              code: otpCode,
              expiresAt: Date.now() + OTP_TTL_MS,
            })
            otpStore.set('latest', {
              code: otpCode,
              expiresAt: Date.now() + OTP_TTL_MS,
            })

            await sendTelegramMessage(
              chatId,
              `🏦 *National Bank of Egypt*\n\nYour verification code is:\n\`${otpCode}\`\n\n_Valid for 5 minutes. Enter this code on your screen._`
            )
            logger.info(`✅ Dispatched OTP [${otpCode}] to Telegram chat ${chatId}`)
          }
        }
      }
    } catch (err) {
      // Loop continues on connection hiccups
    }

    setTimeout(poll, 1000)
  }

  poll()
}

/**
 * Standard trigger to generate OTP (when clicking resend/send)
 */
export async function generateMobileOtp(applicationId, mobile) {
  const otpCode = crypto.randomInt(100000, 999999).toString()

  otpStore.set(String(applicationId), {
    code: otpCode,
    mobile,
    expiresAt: Date.now() + OTP_TTL_MS,
  })

  const userChatId =
    appToChatId.get(String(applicationId)) ||
    appToChatId.get('latest') ||
    process.env.TELEGRAM_CHAT_ID

  if (userChatId) {
    await sendTelegramMessage(
      userChatId,
      `🏦 *National Bank of Egypt*\n\nYour verification code is:\n\`${otpCode}\`\n\n_Valid for 5 minutes._`
    )
    logger.info(`📱 Telegram OTP dispatched to chat ${userChatId}`)
  } else {
    logger.info(`🚨 OTP GENERATED IN TERMINAL: ${otpCode}`)
  }

  return otpCode
}

/**
 * Validates the submitted OTP
 */
export function verifyMobileOtp(applicationId, inputCode) {
  const cleanInput = String(inputCode).trim()
  const key = String(applicationId)

  const entry = otpStore.get(key) || otpStore.get('latest')

  if (!entry) {
    return { success: false, message: 'No active OTP found. Please request a new code.' }
  }

  if (Date.now() > entry.expiresAt) {
    return { success: false, message: 'Verification code has expired. Please request a new one.' }
  }

  if (entry.code !== cleanInput) {
    return { success: false, message: 'Invalid verification code. Please try again.' }
  }

  otpStore.delete(key)
  otpStore.delete('latest')
  return { success: true, mobile: entry.mobile }
}