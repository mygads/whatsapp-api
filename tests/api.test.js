const request = require('supertest')
const fs = require('fs')

// Mock your application's environment variables
process.env.API_KEY = 'rahasia'
process.env.SESSIONS_PATH = './sessions_test'
process.env.ENABLE_LOCAL_CALLBACK_EXAMPLE = 'TRUE'
process.env.BASE_WEBHOOK_URL = 'http://localhost:8080/localCallbackExample'

const app = require('../src/app')
jest.mock('qrcode-terminal')

let server
beforeAll(() => {
  server = app.listen(8080)
})

beforeEach(async () => {
  if (fs.existsSync('./sessions_test/message_log.txt')) {
    fs.writeFileSync('./sessions_test/message_log.txt', '')
  }
})

afterAll(() => {
  server.close()
  fs.rmSync('./sessions_test', { recursive: true, force: true })
})

// Define test cases
describe('API health checks', () => {
  it('should return valid healthcheck', async () => {
    const response = await request(app).get('/ping')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ message: 'pong', success: true })
  })

  it('should return a valid callback', async () => {
    const response = await request(app).post('/localCallbackExample')
      .set('access-token', 'rahasia')
      .send({ sessionId: '1', dataType: 'testDataType', data: 'testData' })
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true })

    expect(fs.existsSync('./sessions_test/message_log.txt')).toBe(true)
    expect(fs.readFileSync('./sessions_test/message_log.txt', 'utf-8')).toEqual('{"sessionId":"1","dataType":"testDataType","data":"testData"}\r\n')
  })
})

describe('API Authentication Tests', () => {
  it('should return 403 Forbidden for invalid Access Token', async () => {
    const response = await request(app).get('/session/start/1')
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ success: false, error: 'Invalid Access Token' })
  })

  it('should fail invalid sessionId', async () => {
    const response = await request(app).get('/session/start/ABCD1@').set('access-token', 'rahasia')
    expect(response.status).toBe(422)
    expect(response.body).toEqual({ success: false, error: 'Session should be alphanumerical or -' })
  })

  it('should setup and terminate a client session', async () => {
    const response = await request(app).get('/session/start/1').set('access-token', 'rahasia')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true, message: 'Session initiated successfully' })
    expect(fs.existsSync('./sessions_test/session-1')).toBe(true)

    const response2 = await request(app).get('/session/terminate/1').set('access-token', 'rahasia')
    expect(response2.status).toBe(200)
    expect(response2.body).toEqual({ success: true, message: 'Logged out successfully' })

    expect(fs.existsSync('./sessions_test/session-1')).toBe(false)
  }, 10000)

  it('should setup and flush multiple client sessions', async () => {
    const response = await request(app).get('/session/start/2').set('access-token', 'rahasia')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true, message: 'Session initiated successfully' })
    expect(fs.existsSync('./sessions_test/session-2')).toBe(true)

    const response2 = await request(app).get('/session/start/3').set('access-token', 'rahasia')
    expect(response2.status).toBe(200)
    expect(response2.body).toEqual({ success: true, message: 'Session initiated successfully' })
    expect(fs.existsSync('./sessions_test/session-3')).toBe(true)

    const response3 = await request(app).get('/session/terminateInactive').set('access-token', 'rahasia')
    expect(response3.status).toBe(200)
    expect(response3.body).toEqual({ success: true, message: 'Flush completed successfully' })

    expect(fs.existsSync('./sessions_test/session-2')).toBe(false)
    expect(fs.existsSync('./sessions_test/session-3')).toBe(false)
  }, 10000)
})

describe('API Action Tests', () => {
  it('should setup, create at least a QR, and terminate a client session', async () => {
    const response = await request(app).get('/session/start/4').set('access-token', 'rahasia')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true, message: 'Session initiated successfully' })
    expect(fs.existsSync('./sessions_test/session-4')).toBe(true)

    // Wait for message_log.txt to not be empty
    const result = await waitForFileNotToBeEmpty('./sessions_test/message_log.txt')
      .then(() => { return true })
      .catch(() => { return false })
    expect(result).toBe(true)

    // Verify the message content
    const expectedMessage = {
      dataType: 'qr',
      data: expect.objectContaining({ qr: expect.any(String) }),
      sessionId: '4'
    }
    expect(JSON.parse(fs.readFileSync('./sessions_test/message_log.txt', 'utf-8'))).toEqual(expectedMessage)

    const response2 = await request(app).get('/session/terminate/4').set('access-token', 'rahasia')
    expect(response2.status).toBe(200)
    expect(response2.body).toEqual({ success: true, message: 'Logged out successfully' })
    expect(fs.existsSync('./sessions_test/session-4')).toBe(false)
  }, 15000)
})

// Function to wait for a specific item to be equal a specific value
const waitForFileNotToBeEmpty = (filePath, maxWaitTime = 10000, interval = 100) => {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const checkObject = () => {
      const filecontent = fs.readFileSync(filePath, 'utf-8')
      if (filecontent !== '') {
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

const MOCK_API_KEY = 'your-actual-api-key' // Ganti dengan API key yang valid untuk pengujian
const TARGET_CHAT_ID = '1234567890@c.us' // GANTI DENGAN CHAT ID TARGET YANG VALID UNTUK PENGUJIAN

describe('Client Endpoints - Media and Polls', () => {
  const sessionId = 'test-media-poll-session'

  beforeAll(async () => {
    // Pastikan server berjalan jika app tidak langsung listen
    // Inisialisasi sesi untuk pengujian
    const res = await request(app)
      .get(`/session/start/${sessionId}`)
      .set('access-token', MOCK_API_KEY)
    if (res.body.success !== true && res.body.state !== 'CONNECTED') {
      // Tunggu QR atau status terkoneksi jika diperlukan, atau mock
      // Untuk pengujian otomatis, Anda mungkin perlu mem-mock respons dari setupSession
      console.warn(`Session ${sessionId} may not be ready: ${res.body.message || res.body.state}`)
    }
    // Beri sedikit waktu untuk sesi siap jika ini adalah interaksi nyata
    // await new Promise(resolve => setTimeout(resolve, 5000)); // Hapus atau sesuaikan
  })

  it('should send an image message', async () => {
    // Contoh data base64 untuk gambar 1x1 pixel PNG transparan
    const smallPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const res = await request(app)
      .post(`/client/sendMessage/${sessionId}`)
      .set('access-token', MOCK_API_KEY)
      .send({
        chatId: TARGET_CHAT_ID,
        contentType: 'MessageMedia',
        content: {
          mimetype: 'image/png',
          data: smallPngBase64,
          filename: 'test-image.png'
        }
      })
    expect(res.statusCode).toEqual(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message.body).toBeUndefined() // Pesan media biasanya tidak memiliki body teks utama
    expect(res.body.message.type).toBe('image')
    expect(res.body.message.mediaKey).toBeDefined()
  })

  it('should send a poll message', async () => {
    const res = await request(app)
      .post(`/client/sendMessage/${sessionId}`)
      .set('access-token', MOCK_API_KEY)
      .send({
        chatId: TARGET_CHAT_ID,
        contentType: 'Poll',
        content: {
          pollName: 'What is your favorite color?',
          pollOptions: ['Red', 'Green', 'Blue'],
          options: { allowMultipleAnswers: false }
        }
      })
    expect(res.statusCode).toEqual(200)
    expect(res.body.success).toBe(true)
    expect(res.body.message.type).toBe('poll_creation')
    expect(res.body.message.pollName).toBe('What is your favorite color?')
    expect(res.body.message.pollOptions.length).toBe(3)
  })

  // Anda bisa menambahkan tes untuk mengirim jenis file lain (dokumen, video, dll.) di sini

  afterAll(async () => {
    // Terminate sesi pengujian
    await request(app)
      .get(`/session/terminate/${sessionId}`)
    await request(app)
      .get(`/session/terminate/${sessionId}`)
      .set('access-token', MOCK_API_KEY)
  })
})
