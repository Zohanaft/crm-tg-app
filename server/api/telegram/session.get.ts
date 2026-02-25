import type { H3Event } from 'h3'
import { eventHandler, getCookie, setResponseStatus } from 'h3'

function handleUnauthorized(event: H3Event) {
  setResponseStatus(event, 401)
  return { loggedIn: false, status: 401, message: 'Unauthorized' }
}

export default eventHandler(async (event) => {
  try {
    const session = getCookie(event, 'tg_user')
    if (!session) return handleUnauthorized(event)

    const decoded = JSON.parse(
      Buffer.from(session, 'base64').toString('utf-8')
    ) as { auth_date?: number; [key: string]: unknown }

    if (decoded.auth_date && Date.now() / 1000 - decoded.auth_date > 86400) {
      return handleUnauthorized(event)
    }

    return { loggedIn: true, ...decoded }
  } catch (err) {
    console.error('Telegram session -', err)
    setResponseStatus(event, 500)
    return {
      loggedIn: false,
      status: 500,
      message: 'Internal Server Error'
    }
  }
})
