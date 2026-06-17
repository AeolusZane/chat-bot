import { WechatyBuilder } from 'wechaty';
import qrcodeTerminal from 'qrcode-terminal';
import config from './config';
import { replyMessage } from './chatgpt';
import { startServer } from './server';
import { logMessage } from './history';

async function onMessage(msg) {
  const contact = msg.talker();
  const contactId = contact.id;
  const receiver = msg.to();
  const content = msg.text().trim();
  const room = msg.room();
  const alias = (await contact.alias()) || (await contact.name());
  const isText = msg.type() === bot.Message.Type.Text;

  // 记录所有文本消息到历史（含机器人自己发的）
  if (isText && content) {
    logMessage({
      time: new Date().toISOString(),
      type: room ? 'room' : 'contact',
      room: room ? await room.topic() : '',
      talker: (await contact.name()) || alias,
      talkerId: contactId,
      self: msg.self(),
      text: content,
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

function onScan(qrcode) {
  qrcodeTerminal.generate(qrcode); // 在console端显示二维码
  const qrcodeImageUrl = [
    'https://api.qrserver.com/v1/create-qr-code/?data=',
    encodeURIComponent(qrcode),
  ].join('');

  console.log(qrcodeImageUrl);
}

async function onLogin(user) {
  console.log(`${user} has logged in`);
  const date = new Date();
  console.log(`Current time:${date}`);
  if (config.autoReply) {
    console.log(`Automatic robot chat mode has been activated`);
  }
  // 登录成功后启动主动发送接口
  startServer(bot);
}

function onLogout(user) {
  console.log(`${user} has logged out`);
}

async function onFriendShip(friendship) {
  if (friendship.type() === 2) {
    if (config.friendShipRule.test(friendship.hello())) {
      await friendship.accept();
    }
  }
}

const bot = WechatyBuilder.build({
  name: 'WechatEveryDay',
  puppet: 'wechaty-puppet-wechat', // 如果有token，记得更换对应的puppet
  puppetOptions: {
    uos: true,
  },
});

bot
  .on('scan', onScan)
  .on('login', onLogin)
  .on('logout', onLogout)
  .on('message', onMessage);
if (config.friendShipRule) {
  bot.on('friendship', onFriendShip);
}

bot
  .start()
  .then(() => console.log('Start to log in wechat...'))
  .catch((e) => console.error(e));
