---
name: wechat-send
description: 通过本地微信机器人查询群/好友/历史消息，并主动向指定微信群或用户发送消息。当用户说"给XX发微信"、"通知群里"、"发条消息给某人/某群"、"微信推送"、"有哪些群/好友"、"查微信历史/聊天记录"等时使用。
---

# 微信机器人接口

本项目（chat-bot）运行着一个 wechaty 微信机器人，登录后在本机起一个 HTTP 接口，可查询群/好友/历史并主动发消息。

## 前置条件

- 机器人必须已启动并登录（`npm run dev`，首次需扫码）。
- 接口地址：`http://127.0.0.1:3001`（端口可由环境变量 `BOT_HTTP_PORT` 覆盖）。
- 若 curl 连接被拒：说明机器人未启动或未登录，提示用户先 `npm run dev` 登录，不要重试。

## 接口列表

### 1. 查看所有群 — `GET /rooms`

```bash
curl -s http://127.0.0.1:3001/rooms
```
返回：`{"ok":true,"count":12,"rooms":[{"id":"...","topic":"群名"},...]}`

### 2. 查看所有好友 — `GET /friends`

```bash
curl -s http://127.0.0.1:3001/friends
```
返回：`{"ok":true,"count":80,"friends":[{"id":"...","name":"昵称","alias":"备注"},...]}`

### 3. 查看历史消息 — `GET /history`

仅包含机器人**启动登录之后**收发的消息（登录前的旧记录无法获取）。

| 查询参数 | 必填 | 说明 |
|----------|------|------|
| `room` | 否 | 按群名过滤 |
| `name` | 否 | 按发送者昵称过滤 |
| `limit` | 否 | 返回最近多少条，默认 50 |

```bash
curl -s "http://127.0.0.1:3001/history?room=群名&limit=100"
curl -s "http://127.0.0.1:3001/history?name=昵称&limit=30"
```
返回：`{"ok":true,"count":N,"records":[{"time","type","room","talker","self","text"},...]}`

### 4. 主动发送消息 — `POST /send`

| 字段 | 必填 | 说明 |
|------|------|------|
| `to` | 是 | 群名称(topic) 或 用户备注/昵称 |
| `message` | 是 | 要发送的文本 |
| `isRoom` | 否 | `true`=发到群；省略或 `false`=发给个人 |

```bash
# 发给群
curl -s -X POST http://127.0.0.1:3001/send \
  -H 'Content-Type: application/json' \
  -d '{"to":"群名称","isRoom":true,"message":"要发送的内容"}'

# 发给个人（先按备注 alias，再按昵称 name 匹配）
curl -s -X POST http://127.0.0.1:3001/send \
  -H 'Content-Type: application/json' \
  -d '{"to":"张三","message":"要发送的内容"}'
```
返回：成功 `{"ok":true,"result":"已发送到群「群名称」"}`；失败 `{"ok":false,"error":"未找到群: 群名称"}`

## 使用要点

1. 不确定确切群名/好友名时，先调 `/rooms` 或 `/friends` 拿到准确名称，再发送，避免"未找到"。
2. 群名要和微信里完全一致；个人优先用备注名。
3. 任何接口返回 `ok:false` 时，把 `error` 如实告诉用户，不要猜测重发。
4. 一次只发一个目标；群发多个时循环逐个调用 `/send`。
