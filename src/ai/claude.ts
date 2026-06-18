import { spawn } from 'child_process';
import config from '../config';

// 每个联系人对应一个 claude 会话 id，用于维持多轮上下文
const sessionMap = new Map<string, string>();

function resetConversation(contactId: string) {
  sessionMap.delete(contactId);
}

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface ClaudeResult {
  result: string;
  session_id: string;
  is_error?: boolean;
  usage?: ClaudeUsage;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
}

// 过滤掉会让嵌套 claude 卡死的环境变量（当 bot 本身从某个 Claude Code 会话里启动时会被继承）
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE')) {
      delete env[key];
    }
  }
  return env;
}

// 调用本地已登录的 claude CLI（系统级 Claude），无需 API key
function callClaude(content: string, sessionId?: string): Promise<ClaudeResult> {
  const args = ['-p', '--output-format', 'json', '--model', 'opus'];
  if (sessionId) {
    args.push('--resume', sessionId);
  }
  args.push(content);

  return new Promise((resolve, reject) => {
    // stdin 必须设为 'ignore'：claude -p 在 stdin 是打开的管道时会一直等待输入，
    // 导致在后台 daemon（无 TTY）里调用时挂死直到超时被杀。
    const child = spawn('claude', args, {
      env: cleanEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error('claude 调用超时'));
    }, 3 * 60 * 1000);

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // 不以退出码判断成败：claude 正常返回时 code 偶尔为 null，
      // 只要 stdout 能解析成有效 JSON 就视为成功。
      try {
        resolve(JSON.parse(stdout) as ClaudeResult);
      } catch (e) {
        reject(new Error(`无法解析 claude 输出: ${stdout || stderr}`));
      }
    });
  });
}

async function getReply(content: string, contactId: string): Promise<string> {
  const sessionId = sessionMap.get(contactId);
  const res = await callClaude(content.trim(), sessionId);

  if (res.is_error) {
    throw new Error(res.result || 'claude 返回错误');
  }

  // 记录会话 id，后续消息走 --resume 维持上下文
  if (res.session_id) {
    sessionMap.set(contactId, res.session_id);
  }

  // 打印本次调用的 token / 费用，便于评估每条消息到底花了多少
  const u = res.usage || {};
  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const cost = res.total_cost_usd != null ? `$${res.total_cost_usd.toFixed(4)}` : 'n/a';
  console.log(
    `[claude usage] contact=${contactId} resume=${sessionId ? 'y' : 'n'} ` +
      `turns=${res.num_turns ?? '?'} dur=${res.duration_ms ?? '?'}ms ` +
      `in=${input} out=${output} cacheRead=${cacheRead} cacheWrite=${cacheWrite} ` +
      `total_in=${input + cacheRead + cacheWrite} cost=${cost}`
  );

  return res.result || '我不太明白你在说什么。';
}

export async function replyMessage(contact, content: string, contactId: string, who: string) {
  try {
    if (content.trim().toLocaleLowerCase() === config.resetKey.toLocaleLowerCase()) {
      resetConversation(contactId);
      await contact.say('上下文已重置。');
      return;
    }

    let message = await getReply(content, contactId);
    message = message.trim();

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      await contact.say(content + '\n-----------\n' + message);
    } else {
      await contact.say(message);
    }
  } catch (e: any) {
    // 出错只记日志，不再给对方发"请求出错"，避免刷屏骚扰
    console.error('[replyMessage error]', e?.message || e);
    resetConversation(contactId);
  }
}
