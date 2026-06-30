require('dotenv').config({ path: '.env.local' });
const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const VERCEL_URL = process.argv[2];

if (!VERCEL_URL) {
  console.error('Uso: node scripts/register-webhook.js https://seu-projeto.vercel.app');
  process.exit(1);
}

const webhookUrl = `${VERCEL_URL}/api/telegram`;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!SECRET) {
  console.error('❌ TELEGRAM_WEBHOOK_SECRET ausente no .env.local. O webhook seria registrado sem proteção e o route rejeitaria os updates.');
  process.exit(1);
}

const body = JSON.stringify({ url: webhookUrl, secret_token: SECRET });

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${TOKEN}/setWebhook`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const result = JSON.parse(data);
    if (result.ok) {
      console.log('✅ Webhook registrado:', webhookUrl);
    } else {
      console.error('❌ Erro:', result.description);
    }
  });
});

req.on('error', (e) => console.error('Erro:', e.message));
req.write(body);
req.end();
