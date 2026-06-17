import fs from 'fs';
import path from 'path';

// 消息以 JSONL 追加存储到项目根目录 data/messages.jsonl
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOG_FILE = path.join(DATA_DIR, 'messages.jsonl');

export interface MsgRecord {
  time: string; // ISO 时间
  type: 'room' | 'contact'; // 群消息 / 私聊
  room: string; // 群名(topic)，私聊为空
  talker: string; // 发送者昵称
  talkerId: string;
  self: boolean; // 是否机器人自己发的
  text: string;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 记录一条消息（追加写，失败不影响主流程）
export function logMessage(record: MsgRecord) {
  try {
    ensureDir();
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
