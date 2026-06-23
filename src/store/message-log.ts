import fs from 'fs';
import path from 'path';

let LOG_FILE = path.resolve(process.cwd(), 'data/messages.jsonl');
let DATA_DIR = path.resolve(process.cwd(), 'data');

export function initLog(accountName: string) {
  const safe = accountName.replace(/[^\w一-龥·@.-]/g, '_');
  DATA_DIR = path.resolve(process.cwd(), 'data', safe);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  LOG_FILE = path.join(DATA_DIR, 'messages.jsonl');
}

export function getDataDir() {
  return DATA_DIR;
}

export interface MsgRecord {
  time: string; // ISO 时间
  type: 'room' | 'contact'; // 群消息 / 私聊
  room: string; // 群名(topic)，私聊为空
  talker: string; // 发送者昵称
  talkerId: string;
  self: boolean; // 是否机器人自己发的
  text: string;
}

// 记录一条消息（追加写，失败不影响主流程）
export function logMessage(record: MsgRecord) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFile(LOG_FILE, JSON.stringify(record) + '\n', (err) => {
      if (err) console.error('写消息日志失败:', err.message);
    });
  } catch (e: any) {
    console.error('写消息日志失败:', e.message);
  }
}

interface QueryOpts {
  room?: string; // 按群名过滤
  name?: string; // 按发送者昵称过滤
  limit?: number; // 返回最近多少条，默认 50
}

// 查询历史消息（返回最近 limit 条）
export function queryHistory(opts: QueryOpts): MsgRecord[] {
  if (!fs.existsSync(LOG_FILE)) return [];

  const limit = opts.limit && opts.limit > 0 ? opts.limit : 50;
  const lines = fs.readFileSync(LOG_FILE, 'utf-8').split('\n');

  const matched: MsgRecord[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let rec: MsgRecord;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (opts.room && rec.room !== opts.room) continue;
    if (opts.name && rec.talker !== opts.name) continue;
    matched.push(rec);
  }

  return matched.slice(-limit);
}
