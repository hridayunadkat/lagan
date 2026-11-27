import { dateKeyInTimeZone, widgetSummary } from '../server/widget-data.js'

const sendError = (response, status, message) =>
  response.status(status).json({ error: message })

const safeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

const bearerToken = (request) => {
  const authorization = request.headers.authorization
  return authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Cache-Control', 'private, no-store')

  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS')
    return sendError(response, 405, 'Method not allowed')
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const widgetToken = process.env.WIDGET_TOKEN
  const userId = process.env.WIDGET_USER_ID
  const timeZone = process.env.WIDGET_TIME_ZONE || 'America/New_York'

  if (!supabaseUrl || !serviceRoleKey || !widgetToken || !userId) {
    return sendError(response, 500, 'Widget endpoint is not configured')
  }
  if (!safeEqual(bearerToken(request), widgetToken)) {
    return sendError(response, 401, 'Unauthorized')
  }

  try {
    const url = new URL('/rest/v1/level_data', supabaseUrl)
    url.searchParams.set('select', 'data')
    url.searchParams.set('user_id', `eq.${userId}`)
    url.searchParams.set('limit', '1')

    const upstream = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    })
    if (!upstream.ok) {
      console.error('Supabase widget request failed', upstream.status, await upstream.text())
      return sendError(response, 502, 'Could not load LAGAN data')
    }

    const rows = await upstream.json()
    if (!rows.length) return sendError(response, 404, 'No synced LAGAN data was found')

    const today = dateKeyInTimeZone(timeZone)
    return response.status(200).json({
      ...widgetSummary(rows[0].data, today),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Widget endpoint failed', error)
    return sendError(response, 500, 'Could not build the widget response')
  }
}
