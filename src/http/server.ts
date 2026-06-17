import http from 'http';
import type { Wechaty } from 'wechaty';
import { handleRequest } from './routes';

// 抑制 GifCodec 警告
process.on('warning', (warning) => {
  if (warning.message.includes('GifCodec')) return;
  console.warn(warning);
});

const PORT = Number(process.env.BOT_HTTP_PORT) || 3001;

export function startServer(bot: Wechaty) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      await handleRequest(bot, req, res);
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
