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

**Base URL**: `http://127.0.0.1:3001`（机器人登录成功后自动启动，端口可通过环境变量 `BOT_HTTP_PORT` 修改）

所有接口均返回 JSON，格式为 `{ ok: boolean, ... }`。

---

### GET /rooms — 获取群列表

```bash
curl http://127.0.0.1:3001/rooms
```

**响应示例：**
```json
{
  "ok": true,
  "count": 32,
  "rooms": [
    { "id": "@@abc123...", "topic": "研发伙" },
    { "id": "@@def456...", "topic": "三位一体" }
  ]
}
```

> `id` 是群的唯一标识，`topic` 是群名。发消息给群时用 `topic` 匹配即可。

---

### GET /friends — 获取好友列表

```bash
curl http://127.0.0.1:3001/friends
```

**响应示例：**
```json
{
  "ok": true,
  "count": 100,
  "friends": [
    { "id": "wxid_xxx", "name": "阿畅", "alias": "老阿畅" }
  ]
}
```

> `name` 是微信昵称，`alias` 是备注名。发消息时用 `name` 或 `alias` 均可匹配。

---

### POST /send — 发送文本消息

**Body 参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `to` | string | ✅ | 好友昵称/备注名，或群名 |
| `message` | string | ✅ | 消息内容 |
| `isRoom` | boolean | ❌ | `true` 表示发到群，默认 `false`（发给个人） |

```bash
# 发给好友
curl -X POST http://127.0.0.1:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "message": "你好！"}'

# 发到群
curl -X POST http://127.0.0.1:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "研发伙", "message": "大家好！", "isRoom": true}'
```

**响应示例：**
```json
{ "ok": true, "result": "消息已发送" }
```

---

### POST /send-file — 发送文件

**Body 参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `to` | string | ✅ | 好友昵称/备注名，或群名 |
| `filePath` | string | ✅ | 服务器本地文件的绝对或相对路径 |
| `isRoom` | boolean | ❌ | `true` 表示发到群 |

```bash
curl -X POST http://127.0.0.1:3001/send-file \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "filePath": "/tmp/report.pdf"}'
```

---

### GET /history — 查询消息历史

**Query 参数：**

| 参数 | 说明 |
|------|------|
| `name` | 按发送人昵称过滤 |
| `room` | 按群名过滤 |
| `limit` | 返回条数（默认全部） |

```bash
# 查某人的私聊记录（最近20条）
curl "http://127.0.0.1:3001/history?name=阿畅&limit=20"

# 查某个群的消息记录
curl "http://127.0.0.1:3001/history?room=研发伙&limit=50"
```

**响应示例：**
```json
{
  "ok": true,
  "count": 5,
  "records": [
    {
      "time": "2026-06-23T08:00:00.000Z",
      "type": "contact",
      "room": "",
      "talker": "阿畅",
      "talkerId": "wxid_xxx",
      "self": false,
      "text": "你好"
    }
  ]
}
```

> `self: true` 表示是机器人自己发的消息，`type` 为 `"room"` 表示群消息，`"contact"` 表示私聊。

---

## 🤖 AI 助手操作流程

### 给好友发消息

```bash
# 1. 先查好友列表，确认昵称或备注
curl http://127.0.0.1:3001/friends | python3 -c "
import sys, json
data = json.load(sys.stdin)
matches = [f for f in data['friends'] if '阿畅' in f.get('name','') or '阿畅' in f.get('alias','')]
print(json.dumps(matches, ensure_ascii=False, indent=2))
"

# 2. 发送消息（用 name 或 alias 均可）
curl -X POST http://127.0.0.1:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "message": "你好！"}'
```

### 给群发消息

```bash
# 1. 先查群列表，确认群名
curl http://127.0.0.1:3001/rooms | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data['rooms']: print(r['topic'])
"

# 2. 发送群消息（必须加 isRoom: true）
curl -X POST http://127.0.0.1:3001/send \
  -H "Content-Type: application/json" \
  -d '{"to": "研发伙", "message": "大家好！", "isRoom": true}'
```

### 给好友发文件

```bash
curl -X POST http://127.0.0.1:3001/send-file \
  -H "Content-Type: application/json" \
  -d '{"to": "阿畅", "filePath": "/tmp/report.pdf"}'
```

---

## 📋 开发规范

每次修改功能或迭代，必须在 `HISTORY.md` 中追加一条记录，格式如下：

```markdown
## YYYY-MM-DD 简述标题

- 具体改动1
- 具体改动2
```

---

## 🛠 系统依赖

以下工具需全局安装，部分功能依赖它们：

| 工具 | 用途 | 安装命令 |
|------|------|---------|
| **ffmpeg** | 音频格式转换（silk → wav） | `brew install ffmpeg` |
| **openai-whisper** | 语音转文字（large 模型） | `pip3 install openai-whisper --break-system-packages` |

> Whisper large 模型（~3GB）首次运行时自动下载到 `~/.cache/whisper/`，无需手动操作。

---

## 📝 技术栈

- **Wechaty**: 微信机器人框架
- **FileBox**: 文件传输支持
- **TypeScript**: 开发语言
- **Node.js >= 16.8**: 运行环境
- **Python 3**: 语音识别（Whisper）
