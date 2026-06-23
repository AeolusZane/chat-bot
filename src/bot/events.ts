import type { Wechaty } from 'wechaty';
import qrcodeTerminal from 'qrcode-terminal';
import config from '../config';
import { replyMessage } from '../ai/claude';
import { logMessage, initLog, getDataDir, cleanupOldData } from '../store/message-log';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { startServer } from '../http/server';

export function registerEvents(bot: Wechaty) {
  bot.on('scan', onScan);
  bot.on('login', (user) => onLogin(bot, user));
  bot.on('logout', onLogout);
  bot.on('message', (msg) => onMessage(bot, msg));
  // 监听 error/reset，避免 wechaty-puppet-wechat 网页协议心跳超时时
  // 抛出未处理的 'error' 事件导致整个进程崩溃
  bot.on('error', (err) => console.error('[wechaty error]', err?.message || err));
  bot.on('reset', (reason) => console.warn('[wechaty reset]', reason));

  if (config.friendShipRule) {
    bot.on('friendship', onFriendShip);
  }
}

async function onMessage(bot: Wechaty, msg: any) {
  const contact = msg.talker();
  const contactId = contact.id;
  const receiver = msg.to();
  const content = msg.text().trim();
  const room = msg.room();
  const alias = (await contact.alias()) || (await contact.name());
  const isText = msg.type() === bot.Message.Type.Text;

  const MSG_TYPE_LABEL: Record<number, string> = {
    [bot.Message.Type.Audio]: '[语音]',
    [bot.Message.Type.Video]: '[视频]',
    [bot.Message.Type.Attachment]: '[文件]',
    [bot.Message.Type.Emoticon]: '[表情]',
    [bot.Message.Type.Location]: '[位置]',
    [bot.Message.Type.MiniProgram]: '[小程序]',
    [bot.Message.Type.Url]: '[链接]',
    [bot.Message.Type.Contact]: '[名片]',
    [bot.Message.Type.RedEnvelope]: '[红包]',
    [bot.Message.Type.Transfer]: '[转账]',
    [bot.Message.Type.Recalled]: '[撤回消息]',
  };

  let logText = isText ? content : (MSG_TYPE_LABEL[msg.type()] ?? `[消息类型:${msg.type()}]`);

  // 图片：下载保存到本地
  if (msg.type() === bot.Message.Type.Image) {
    try {
      const fileBox = await msg.toFileBox();
      const date = new Date().toISOString().slice(0, 10);
      const imgDir = path.join(getDataDir(), 'images', date);
      fs.mkdirSync(imgDir, { recursive: true });
      const fileName = `${Date.now()}_${fileBox.name}`;
      const filePath = path.join(imgDir, fileName);
      await fileBox.toFile(filePath, true);
      logText = `[图片:${filePath}]`;
    } catch (e: any) {
      logText = '[图片:下载失败]';
    }
  }

  // 语音：下载 silk 文件，调 whisper 转文字
  if (msg.type() === bot.Message.Type.Audio) {
    try {
      const fileBox = await msg.toFileBox();
      const date = new Date().toISOString().slice(0, 10);
      const audioDir = path.join(getDataDir(), 'audio', date);
      fs.mkdirSync(audioDir, { recursive: true });
      const silkPath = path.join(audioDir, `${Date.now()}.silk`);
      await fileBox.toFile(silkPath, true);
      const scriptPath = path.resolve(process.cwd(), 'scripts/transcribe.py');
      const transcript = await new Promise<string>((resolve) => {
        execFile('python3', [scriptPath, silkPath], { timeout: 120000 }, (err, stdout) => {
          resolve(stdout?.trim() || '[语音:转文字失败]');
        });
      });
      logText = `[语音:${transcript}]`;
    } catch (e: any) {
      logText = '[语音:下载失败]';
    }
  }

  // 记录所有消息到历史（含机器人自己发的）
  if (logText) {
    logMessage({
      time: new Date().toISOString(),
      type: room ? 'room' : 'contact',
      room: room ? await room.topic() : '',
      talker: (await contact.name()) || alias,
      talkerId: contactId,
      self: msg.self(),
      text: logText,
    });
  }

  if (msg.self()) {
    return;
  }

  if (room && isText) {
    const topic = await room.topic();
    console.log(
      `Group name: ${topic} talker: ${await contact.name()} content: ${content}`
    );

    const pattern = RegExp(`^@${receiver.name()}\\s+${config.groupKey}[\\s]*`);
    if (await msg.mentionSelf()) {
      if (pattern.test(content)) {
        const groupContent = content.replace(pattern, '');
        replyMessage(room, groupContent, contactId, alias);
        return;
      } else {
        console.log(
          'Content is not within the scope of the customizition format'
        );
      }
    }
  } else if (isText) {
    console.log(`talker: ${alias} content: ${content}`);
    if (config.autoReply) {
      if (content.startsWith(config.privateKey)) {
        replyMessage(
          contact,
          content.substring(config.privateKey.length).trim(),
          contactId,
          alias
        );
      } else {
        console.log(
          'Content is not within the scope of the customizition format'
        );
      }
    }
  }
}

function onScan(qrcode: string) {
  qrcodeTerminal.generate(qrcode);
  const qrcodeImageUrl = [
    'https://api.qrserver.com/v1/create-qr-code/?data=',
    encodeURIComponent(qrcode),
  ].join('');
  console.log(qrcodeImageUrl);
}

async function onLogin(bot: Wechaty, user: any) {
  console.log(`${user} has logged in`);
  console.log(`Current time:${new Date()}`);
  initLog(user.name());
  // 登录时清理一次，之后每 24 小时清理一次（仅保留最近 50 天）
  cleanupOldData();
  setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
  if (config.autoReply) {
    console.log(`Automatic robot chat mode has been activated`);
  }
  startServer(bot);
}

function onLogout(user: any) {
  console.log(`${user} has logged out`);
}

async function onFriendShip(friendship: any) {
  if (friendship.type() === 2) {
    if (config.friendShipRule.test(friendship.hello())) {
      await friendship.accept();
    }
  }
}
