// server.js — despliega en Railway con Node.js
const { Client, LocalAuth } = require('whatsapp-web.js')
const express = require('express')
const qrcode = require('qrcode-terminal')
const app = express()
app.use(express.json())

let client, isReady = false, qrData = null

function initClient() {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  })

  client.on('qr', qr => {
    qrData = qr
    qrcode.generate(qr, { small: true })
    console.log('📱 Escanea el QR con tu WhatsApp')
  })

  client.on('ready', () => {
    isReady = true
    qrData = null
    console.log('✅ WhatsApp conectado')
  })

  client.on('disconnected', () => {
    isReady = false
    console.log('❌ Desconectado, reconectando...')
    setTimeout(initClient, 5000)
  })

  client.initialize()
}
initClient()

// Ver QR desde el navegador (para Railway)
app.get('/qr', (req, res) => {
  if (isReady) return res.json({ status: 'connected' })
  if (!qrData) return res.json({ status: 'loading' })
  res.json({ status: 'qr_required', qr: qrData })
})

// Validar un número
app.post('/validate', async (req, res) => {
  if (req.headers.authorization !== \`Bearer \${process.env.SECRET_TOKEN}\`)
    return res.status(401).json({ error: 'Unauthorized' })
  if (!isReady)
    return res.status(503).json({ error: 'WhatsApp no listo' })
  const { phone } = req.body
  const result = await client.getNumberId(phone).catch(() => null)
  res.json({ phone, has_whatsapp: !!result })
})

// Validar bulk
app.post('/validate-bulk', async (req, res) => {
  if (req.headers.authorization !== \`Bearer \${process.env.SECRET_TOKEN}\`)
    return res.status(401).json({ error: 'Unauthorized' })
  if (!isReady)
    return res.status(503).json({ error: 'WhatsApp no listo' })
  const { numbers } = req.body
  const results = []
  for (const phone of numbers) {
    try {
      const id = await client.getNumberId(phone).catch(() => null)
      results.push({ phone, has_whatsapp: !!id })
    } catch {
      results.push({ phone, has_whatsapp: false, error: true })
    }
    await new Promise(r => setTimeout(r, 800))
  }
  res.json({ results })
})

app.get('/status', (_, res) => res.json({ ready: isReady }))
app.listen(3000)
