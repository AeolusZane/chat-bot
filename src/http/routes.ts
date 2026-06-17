import { URL } from 'url';
import type { Wechaty } from 'wechaty';
import { queryHistory } from '../store/message-log';
import { listRooms, listFriends } from './handlers/contacts';
import { sendMessage, sendFile, readJson } from './handlers/message';

export async function handleRequest(
  bot: Wechaty,
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
) {
  if (req.method === 'GET' && req.url === '/rooms') {
    const rooms = await listRooms(bot);
    return json(res, 200, { ok: true, count: rooms.length, rooms });
  }

  if (req.method === 'GET' && req.url === '/friends') {
    const friends = await listFriends(bot);
    return json(res, 200, { ok: true, count: friends.length, friends });
  }

  if (req.method === 'GET' && req.url?.startsWith('/history')) {
    const u = new URL(req.url, 'http://127.0.0.1');
    const records = queryHistory({
      room: u.searchParams.get('room') || undefined,
      name: u.searchParams.get('name') || undefined,
      limit: Number(u.searchParams.get('limit')) || undefined,
    });
    return json(res, 200, { ok: true, count: records.length, records });
  }

  if (req.method === 'POST' && req.url === '/send') {
    const body = await readJson(req);
    const result = await sendMessage(bot, body);
    return json(res, 200, { ok: true, result });
  }

  if (req.method === 'POST' && req.url === '/send-file') {
    const body = await readJson(req);
    const result = await sendFile(bot, body);
    return json(res, 200, { ok: true, result });
  }

  return json(res, 404, {
    ok: false,
    error: 'GET /rooms | GET /friends | GET /history | POST /send | POST /send-file',
  });
}

function json(res: import('http').ServerResponse, status: number, data: any) {
  res.statusCode = status;
  res.end(JSON.stringify(data));
}
