# 功能迭代记录

## 2026-06-23 图片保存 + 语音转文字

- 图片消息：下载保存到 `data/{账号}/images/{日期}/` 目录，日志记录文件路径
- 语音消息：下载 silk 文件，通过 pilk 解码 + Whisper large 模型转文字，日志记录转录文本
- 新增 `scripts/transcribe.py` 语音转文字脚本
- AGENT.md 补充系统依赖说明（ffmpeg、openai-whisper、pilk）

## 2026-06-23 初始化功能迭代记录

- 重命名 README_AGENT.md → AGENT.md，补全 HTTP API 文档（响应示例、参数说明）
- 消息日志按账号隔离：登录后存到 `data/{账号名}/messages.jsonl`
- 关闭自动 AI 回复（`autoReply: false`）
- 消息记录扩展支持非文本消息（图片、语音、视频、文件、表情等，记录为类型标签）
- 新增开发规范：每次功能迭代记录到 HISTORY.md
