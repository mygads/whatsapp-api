const { globalApiKey, rateLimitMax, rateLimitWindowMs } = require('./config')
const { sendErrorResponse } = require('./utils')
const { validateSession } = require('./sessions')
const rateLimiting = require('express-rate-limit')

const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString()
  const method = req.method
  const url = req.originalUrl || req.url
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress
  const userAgent = req.get('User-Agent') || 'Unknown'

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`)

  // Log request body untuk POST/PUT/PATCH (hanya untuk debugging, hati-hati dengan data sensitif)
  if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
    console.log(`[${timestamp}] Request Body:`, JSON.stringify(req.body, null, 2))
  }

  next()
}

const apikey = async (req, res, next) => {
  /*
    #swagger.security = [{
          "apiKeyAuth": []
    }]
  */
  /* #swagger.responses[403] = {
        description: "Forbidden.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/ForbiddenResponse" }
          }
        }
      }
  */
  const reqApiKey = req.header('access-token') // MODIFIED: Changed 'Access Token' to 'access-token'

  // Log untuk debugging
  // console.log('----- Access Token Check -----')
  // console.log('Configured Access Token:', globalApiKey)
  // console.log('Received Access Token Header:', reqApiKey)
  // console.log('-------------------------')

  if (globalApiKey && globalApiKey !== reqApiKey) {
    console.log('Access Token mismatch! Blocking request.') // Tambahan log
    return res.status(401).json({ success: false, error: 'Invalid Access Token' })
  }
  next()
}

const sessionNameValidation = async (req, res, next) => {
  /*
    #swagger.parameters['sessionId'] = {
      in: 'path',
      description: 'Unique identifier for the session (alphanumeric and - allowed)',
      required: true,
      type: 'string',
      example: 'f8377d8d-a589-4242-9ba6-9486a04ef80c'
    }
  */
  if ((!/^[\w-]+$/.test(req.params.sessionId))) {
    /* #swagger.responses[422] = {
        description: "Unprocessable Entity.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/ErrorResponse" }
          }
        }
      }
    */
    return sendErrorResponse(res, 422, 'Session should be alphanumerical or -')
  }
  next()
}

const sessionValidation = async (req, res, next) => {
  const validation = await validateSession(req.params.sessionId)
  if (validation.success !== true) {
    /* #swagger.responses[404] = {
        description: "Not Found.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/NotFoundResponse" }
          }
        }
      }
    */
    return sendErrorResponse(res, 404, validation.message)
  }
  next()
}

const rateLimiter = rateLimiting({
  max: rateLimitMax,
  windowMS: rateLimitWindowMs,
  message: "You can't make any more requests at the moment. Try again later"
})

const sessionSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Session']
  */
  next()
}

const clientSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Client']
  */
  next()
}

const contactSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Contact']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          contactId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the contact',
            example: '6281288888888@c.us'
          }
        }
      }
    }
  */
  next()
}

const messageSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Message']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'The Chat id which contains the message',
            example: '6281288888888@c.us'
          },
          messageId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the message',
            example: 'ABCDEF999999999'
          }
        }
      }
    }
  */
  next()
}

const chatSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Chat']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the given Chat (either group or personnal)',
            example: '6281288888888@c.us'
          }
        }
      }
    }
  */
  next()
}

const groupChatSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Group Chat']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the given Chat (either group or personnal)',
            example: '6281288888888@c.us'
          }
        }
      }
    }
  */
  next()
}

module.exports = {
  sessionValidation,
  apikey,
  sessionNameValidation,
  sessionSwagger,
  clientSwagger,
  contactSwagger,
  messageSwagger,
  chatSwagger,
  groupChatSwagger,
  rateLimiter,
  requestLogger
}
