import { WechatyBuilder } from 'wechaty';
import qrcodeTerminal from 'qrcode-terminal';
import config from '../config';
import { startServer } from '../http/server';
import { registerEvents } from './events';

export function createBot() {
  const bot = WechatyBuilder.build({
    name: 'WechatEveryDay',
    puppet: 'wechaty-puppet-wechat',
    puppetOptions: {
      uos: true,
    },
  });

  registerEvents(bot);

  return bot;
}

export function startBot(bot: ReturnType<typeof createBot>) {
  bot
    .start()
    .then(() => console.log('Start to log in wechat...'))
    .catch((e) => console.error(e));
}
