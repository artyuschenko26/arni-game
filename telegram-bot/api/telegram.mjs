import { timingSafeEqual } from 'node:crypto';

const startCommand = /^\/start(?:@arnigame_bot)?(?:\s|$)/i;
const games = [
  { title: 'ARNI RUSH', url: 'https://t.me/arnigame_bot/arnigame_play' },
];
const welcome = '🎮 Добро пожаловать в ARNI GAMES!\n\nARNI RUSH — убегай от дрона по неоновому городу, собирай монеты и бей свой рекорд.\n\nВыбирай игру и жми «Играть»!';

function validSecret(provided, expected) {
  if (!provided || !expected) return false;
  const input = Buffer.from(provided);
  const secret = Buffer.from(expected);
  return input.length === secret.length && timingSafeEqual(input, secret);
}

export async function POST(request) {
  const provided = request.headers.get('x-telegram-bot-api-secret-token');
  if (!validSecret(provided, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response(null, { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const message = update?.message;
  if (message?.chat?.type !== 'private' ||
      !Number.isSafeInteger(message.chat.id) ||
      typeof message.text !== 'string' ||
      !startCommand.test(message.text)) {
    return new Response(null, { status: 200 });
  }

  const cover = process.env.TELEGRAM_WELCOME_PHOTO?.trim();
  return Response.json({
    ...(cover
      ? { method: 'sendPhoto', photo: cover, caption: welcome }
      : { method: 'sendMessage', text: welcome }),
    chat_id: message.chat.id,
    reply_markup: {
      inline_keyboard: games.map(({ title, url }) => [{ text: `🎮 Играть в ${title}`, url }]),
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const request = new Request('https://localhost/api/telegram', {
    method: 'POST',
    headers: req.headers,
    body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null),
  });
  const response = await POST(request);
  const contentType = response.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);
  return res.status(response.status).send(await response.text());
}
