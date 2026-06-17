import { execFile } from 'child_process';
import config from '../config';

// 每个联系人对应一个 claude 会话 id，用于维持多轮上下文
const sessionMap = new Map<string, string>();

function resetConversation(contactId: string) {
  sessionMap.delete(contactId);
}

interface ClaudeResult {
  result: string;
  session_id: string;
  is_error?: boolean;
}

// 调用本地已登录的 claude CLI（系统级 Claude），无需 API key
function callClaude(content: string, sessionId?: string): Promise<ClaudeResult> {
  const args = ['-p', '--output-format', 'json', '--model', 'opus'];
  if (sessionId) {
    args.push('--resume', sessionId);
  }
  args.push(content);

  return new Promise((resolve, reject) => {
    execFile(
      'claude',
      args,
      { maxBuffer: 10 * 1024 * 1024, timeout: 3 * 60 * 1000 },
      (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        try {
          resolve(JSON.parse(stdout) as ClaudeResult);
        } catch (e) {
          reject(new Error(`无法解析 claude 输出: ${stdout || stderr}`));
        }
      }
    );
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
    console.error(e);
    resetConversation(contactId);
    await contact.say('请求出错，请稍后重试。');
  }
}
