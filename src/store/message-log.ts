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

const RETENTION_DAYS = 50;

// 清理超过保留期的消息记录和媒体文件
export function cleanupOldData() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  // 1. 清理 messages.jsonl 中过期的消息
  try {
    if (fs.existsSync(LOG_FILE)) {
      const lines = fs.readFileSync(LOG_FILE, 'utf-8').split('\n');
      const kept: string[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const rec: MsgRecord = JSON.parse(line);
          if (new Date(rec.time).getTime() >= cutoff) kept.push(line);
        } catch {
          continue;
        }
      }
      fs.writeFileSync(LOG_FILE, kept.length ? kept.join('\n') + '\n' : '');
    }
  } catch (e: any) {
    console.error('清理消息日志失败:', e.message);
  }

  // 2. 清理 images / audio 下按日期命名的过期子目录
  for (const sub of ['images', 'audio']) {
    const baseDir = path.join(DATA_DIR, sub);
    if (!fs.existsSync(baseDir)) continue;
    try {
      for (const name of fs.readdirSync(baseDir)) {
        const t = new Date(name).getTime(); // 目录名是 YYYY-MM-DD
        if (!isNaN(t) && t < cutoff) {
          fs.rmSync(path.join(baseDir, name), { recursive: true, force: true });
          console.log(`已清理过期目录: ${sub}/${name}`);
        }
      }
    } catch (e: any) {
      console.error(`清理 ${sub} 目录失败:`, e.message);
    }
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
