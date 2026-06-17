import http from 'http';
import { URL } from 'url';
import path from 'path';
import fs from 'fs';
import type { Wechaty } from 'wechaty';
import { FileBox } from 'file-box';
import { queryHistory } from './history';

// 抑制 GifCodec 警告
process.on('warning', (warning) => {
  if (warning.message.includes('GifCodec')) {
    return; // 忽略 GifCodec 相关警告
  }
  console.warn(warning);
});

const PORT = Number(process.env.BOT_HTTP_PORT) || 3001;

interface SendBody {
  to: string; // 群名(topic) 或 用户名/备注
  message: string;
  isRoom?: boolean; // true=发群, false/省略=发个人
}

interface SendFileBody {
  to: string; // 群名(topic) 或 用户名/备注
  filePath: string; // 文件路径
  isRoom?: boolean; // true=发群, false/省略=发个人
}

function readJson(req: http.IncomingMessage): Promise<SendBody> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (e) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function listRooms(bot: Wechaty) {
  const rooms = await bot.Room.findAll();
  const result: Array<{ id: string; topic: string }> = [];
  for (const room of rooms) {
    result.push({ id: room.id, topic: await room.topic() });
  }
  return result;
}

async function listFriends(bot: Wechaty) {
  const contacts = await bot.Contact.findAll();
  const result: Array<{ id: string; name: string; alias: string }> = [];
  for (const c of contacts) {
    // 只保留个人好友
    if (c.type() !== bot.Contact.Type.Individual) continue;
    if (!c.friend()) continue;
    result.push({
      id: c.id,
      name: c.name(),
      alias: (await c.alias()) || '',
    });
  }
  return result;
}

async function sendMessage(bot: Wechaty, body: SendBody) {
  const { to, message, isRoom } = body;
  if (!to || !message) {
    throw new Error('缺少参数 to 或 message');
  }

  if (isRoom) {
    const room = await bot.Room.find({ topic: to });
    if (!room) throw new Error(`未找到群: ${to}`);
    await room.say(message);
    return `已发送到群「${to}」`;
  }

  // 个人：先按备注/名称找，找不到再按昵称
  let contact = await bot.Contact.find({ alias: to });
  if (!contact) contact = await bot.Contact.find({ name: to });
  if (!contact) throw new Error(`未找到用户: ${to}`);
  await contact.say(message);
  return `已发送给用户「${to}」`;
}

async function sendFile(bot: Wechaty, body: SendFileBody) {
  const { to, filePath, isRoom } = body;
  if (!to || !filePath) {
    throw new Error('缺少参数 to 或 filePath');
  }

  // 解析文件路径（支持相对路径和绝对路径）
  const resolvedPath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);

  // 检查文件是否存在
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`文件不存在: ${resolvedPath}`);
  }

  // 创建 FileBox 对象
  const fileBox = FileBox.fromFile(resolvedPath);

  if (isRoom) {
    const room = await bot.Room.find({ topic: to });
    if (!room) throw new Error(`未找到群: ${to}`);
    await room.say(fileBox);
    return `已发送文件到群「${to}」`;
  }

  // 个人：先按备注/名称找，找不到再按昵称
  let contact = await bot.Contact.find({ alias: to });
  if (!contact) contact = await bot.Contact.find({ name: to });
  if (!contact) throw new Error(`未找到用户: ${to}`);
  await contact.say(fileBox);
  return `已发送文件给用户「${to}」`;
}

export function startServer(bot: Wechaty) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      if (req.method === 'GET' && req.url === '/rooms') {
        const rooms = await listRooms(bot);
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, count: rooms.length, rooms }));
        return;
      }

      if (req.method === 'GET' && req.url === '/friends') {
        const friends = await listFriends(bot);
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, count: friends.length, friends }));
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/history')) {
        const u = new URL(req.url, 'http://127.0.0.1');
        const records = queryHistory({
          room: u.searchParams.get('room') || undefined,
          name: u.searchParams.get('name') || undefined,
          limit: Number(u.searchParams.get('limit')) || undefined,
        });
        res.statusCode = 200;
        res.end(
          JSON.stringify({ ok: true, count: records.length, records })
        );
        return;
      }

      if (req.method === 'POST' && req.url === '/send') {
        const body = await readJson(req);
        const result = await sendMessage(bot, body);
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, result }));
        return;
      }

      if (req.method === 'POST' && req.url === '/send-file') {
        const body = await readJson(req) as any;
        const result = await sendFile(bot, body);
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, result }));
        return;
      }

      res.statusCode = 404;
      res.end(
        JSON.stringify({
          ok: false,
          error: 'GET /rooms | GET /friends | GET /history | POST /send | POST /send-file',
        })
      );
    } catch (e: any) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`主动发送接口已启动:`);
    console.log(`  - 文本消息: http://127.0.0.1:${PORT}/send (POST)`);
    console.log(`  - 文件发送: http://127.0.0.1:${PORT}/send-file (POST)`);
    console.log(`  - 好友列表: http://127.0.0.1:${PORT}/friends (GET)`);
    console.log(`  - 群列表:   http://127.0.0.1:${PORT}/rooms (GET)`);
    console.log(`  - 历史记录: http://127.0.0.1:${PORT}/history (GET)`);
  });
}
