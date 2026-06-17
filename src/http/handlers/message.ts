import path from 'path';
import fs from 'fs';
import type { Wechaty } from 'wechaty';
import { FileBox } from 'file-box';

export interface SendBody {
  to: string;
  message: string;
  isRoom?: boolean;
}

export interface SendFileBody {
  to: string;
  filePath: string;
  isRoom?: boolean;
}

export function readJson(req: import('http').IncomingMessage): Promise<any> {
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

async function findTarget(bot: Wechaty, to: string, isRoom?: boolean) {
  if (isRoom) {
    const room = await bot.Room.find({ topic: to });
    if (!room) throw new Error(`未找到群: ${to}`);
    return room;
  }
  let contact = await bot.Contact.find({ alias: to });
  if (!contact) contact = await bot.Contact.find({ name: to });
  if (!contact) throw new Error(`未找到用户: ${to}`);
  return contact;
}

export async function sendMessage(bot: Wechaty, body: SendBody) {
  const { to, message, isRoom } = body;
  if (!to || !message) {
    throw new Error('缺少参数 to 或 message');
  }
  const target = await findTarget(bot, to, isRoom);
  await target.say(message);
  return `已发送到${isRoom ? '群' : '用户'}「${to}」`;
}

export async function sendFile(bot: Wechaty, body: SendFileBody) {
  const { to, filePath, isRoom } = body;
  if (!to || !filePath) {
    throw new Error('缺少参数 to 或 filePath');
  }

  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`文件不存在: ${resolvedPath}`);
  }

  const fileBox = FileBox.fromFile(resolvedPath);
  const target = await findTarget(bot, to, isRoom);
  await target.say(fileBox);
  return `已发送文件到${isRoom ? '群' : '用户'}「${to}」`;
}
