const axios = require('axios')
const { globalApiKey, disabledCallbacks } = require('./config')
const crypto = require('crypto')

// Trigger webhook endpoint
const triggerWebhook = async (webhookURL, sessionId, event, data = {}) => {
  try {
    // Ensure sessionId is in the URL path
    const fullWebhookURL = webhookURL.includes(sessionId)
      ? webhookURL
      : `${webhookURL}/${sessionId}`

    // Payload to send
    const payload = {
      sessionId,
      event,
      data
    }

    console.log(`[WEBHOOK] Sending ${event} event for session ${sessionId}`)
    // console.log('[WEBHOOK] Payload:', JSON.stringify(payload, null, 2))

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'WhatsApp-Server/1.0'
    }

    const webhookSecret = globalApiKey
    if (webhookSecret) {
      const payloadString = JSON.stringify(payload)
      const signature = crypto.createHmac('sha256', webhookSecret).update(payloadString).digest('hex')
      headers['X-Webhook-Signature'] = `sha256=${signature}`
    }

    // Send POST request using axios
    const response = await axios.post(fullWebhookURL, payload, {
      headers,
      timeout: 10000 // 10 seconds
    })

    if (response.status >= 200 && response.status < 300) {
      console.log(`[WEBHOOK] Success: ${event} event processed for session ${sessionId}`)
      return response.data
    } else {
      console.error(`[WEBHOOK] Error ${response.status}: ${response.statusText}`)
      throw new Error(`Webhook failed with status ${response.status}`)
    }
  } catch (error) {
    console.error('[WEBHOOK] Error sending webhook:', error.message)
    // Don't throw error to prevent breaking WhatsApp session
    return { success: false, error: error.message }
  }
}

// Function to send a response with error status and message
const sendErrorResponse = (res, status, message) => {
  res.status(status).json({ success: false, error: message })
}

// Function to wait for a specific item not to be null
const waitForNestedObject = (rootObj, nestedPath, maxWaitTime = 10000, interval = 100) => {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const checkObject = () => {
      const nestedObj = nestedPath.split('.').reduce((obj, key) => obj ? obj[key] : undefined, rootObj)
      if (nestedObj) {
        // Nested object exists, resolve the promise
        resolve()
      } else if (Date.now() - start > maxWaitTime) {
        // Maximum wait time exceeded, reject the promise
        console.log('Timed out waiting for nested object')
        reject(new Error('Timeout waiting for nested object'))
      } else {
        // Nested object not yet created, continue waiting
        setTimeout(checkObject, interval)
      }
    }
    checkObject()
  })
}

const checkIfEventisEnabled = (event) => {
  return new Promise((resolve, reject) => { if (!disabledCallbacks.includes(event)) { resolve() } })
}

module.exports = {
  triggerWebhook,
  sendErrorResponse,
  waitForNestedObject,
  checkIfEventisEnabled
}
