# ChatGPT 微信机器人 - AI 助手使用指南

## 📋 项目概述

这是一个基于 **Wechaty** + **ChatGPT** 的微信智能机器人，支持自动回复、群聊互动、上下文对话管理，并提供 HTTP API 用于主动发送消息和查询数据。

**核心能力：**
- 🤖 智能对话：集成 ChatGPT/Claude/OpenAI，支持自然语言交互
- 💬 自动回复：私聊/群聊自动响应，支持关键词唤醒
- 🔄 上下文管理：保持对话历史，支持重置（关键词 `reset`）
- 🌐 HTTP API：提供 RESTful 接口用于主动发消息、查好友/群列表、查历史记录
- 📎 文件发送：支持通过 FileBox 发送图片、文档等文件
- 🐳 Docker 支持：容器化部署

---

## 🚀 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置（可选）

编辑 `src/config.ts`：

```typescript
export default {
  chatGPTSessionToken: '',  // ChatGPT session token（如使用官方 API）
  clearanceToken: '',       // Cloudflare clearance token
  userAgent: '',            // User-Agent
  retryTimes: 3,            // 重试次数
  groupKey: '',             // 群聊唤醒关键词（空则 @机器人 即可）
  privateKey: '',           // 私聊唤醒前缀（空则自动回复所有消息）
  resetKey: 'reset',        // 重置上下文的关键词
  autoReply: true,          // 是否开启自动回复
  friendShipRule: /chatgpt|chat/,  // 自动通过好友验证的正则
  groupReplyMode: false,    // 群聊是否用回复格式
  privateReplyMode: false,  // 私聊是否用回复格式
};
```

### 3. 启动机器人

```bash
npm run dev
```

启动后终端会输出二维码链接，用微信扫码登录即可。

---

## 🌐 HTTP API 接口

机器人登录成功后会自动启动 HTTP 服务（默认端口 `3001`）。

### 1. 发送文本消息

**接口**: `POST /send`

```bash
curl -X POST http://127.0.0.1:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "message": "你好！"}'
```

### 2. 发送文件

**接口**: `POST /send-file`

```bash
curl -X POST http://127.0.0.1:3001/send-file \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "filePath": "./report.pdf"}'
```

### 3. 获取好友列表

**接口**: `GET /friends`

```bash
curl http://127.0.0.1:3001/friends
```

### 4. 获取群列表

**接口**: `GET /rooms`

```bash
curl http://127.0.0.1:3001/rooms
```

### 5. 查询消息历史

**接口**: `GET /history?name=阿畅&limit=20`

---

## 🤖 AI 助手操作流程

### 给某人发文本消息

```bash
# 1. 查找联系人
curl http://127.0.0.1:3001/friends | python3 -c "
import sys, json
data = json.load(sys.stdin)
matches = [f for f in data['friends'] if '阿畅' in f.get('name','') or '阿畅' in f.get('alias','')]
print(json.dumps(matches, ensure_ascii=False, indent=2))
"

# 2. 发送消息
curl -X POST http://127.0.0.1:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "message": "你好！"}'
```

### 给某人发文件

```bash
curl -X POST http://127.0.0.1:3001/send-file \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "filePath": "./test_message.txt"}'
```

### 给群发消息

```bash
curl -X POST http://127.0.0.1:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "技术交流群", "message": "大家好！", "isRoom": true}'
```

---

## 📝 技术栈

- **Wechaty**: 微信机器人框架
- **FileBox**: 文件传输支持
- **TypeScript**: 开发语言
- **Node.js >= 16.8**: 运行环境
