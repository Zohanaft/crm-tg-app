import { eventHandler, getCookie } from 'h3'
import * as crypto from 'node:crypto'

const handleUnauthorized = () => ({
  loggedIn: false,
  status: 401,
  message: 'Unauthorized'
})

export default eventHandler(async (event) => {
  try {
    const session = getCookie(event, 'tg_user')
    const config = useRuntimeConfig(event)

    if (!session) return handleUnauthorized()

    const decodedCookie = JSON.parse(
      Buffer.from(session, 'base64').toString('utf-8')
    ) as { auth_date: number; hash: string; [key: string]: unknown }

    if (Date.now() / 1000 - decodedCookie.auth_date > 86400) {
      return handleUnauthorized()
    }

    const telegramApiToken = config.TELEGRAM_TOKEN as string | undefined

    if (!telegramApiToken) {
      return {
        loggedIn: false,
        status: 500,
        message: 'Telegram bot token is not configured'
      }
    }

    const secret = crypto.createHash('sha256').update(telegramApiToken).digest()

    const dataCheckString = Object.keys(decodedCookie)
      .filter((k) => k !== 'hash')
      .sort()
      .map((k) => `${k}=${decodedCookie[k]}`)
      .join('\n')

    const checkHash = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex')

    return {
      loggedIn: checkHash === decodedCookie.hash,
      ...decodedCookie
    }
  } catch (err) {
    console.error('Telegram Auth -', err)
    return {
      loggedIn: false,
      status: 500,
      message: 'Internal Server Error'
    }
  }
})
