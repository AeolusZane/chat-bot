// import { ChatGPTAPI } from 'chatgpt';
import pTimeout from 'p-timeout';
import config from './config';
import { retryRequest } from './utils';
import { Configuration, OpenAIApi } from 'openai';
import { pluginConfig } from './api';

const configuration = new Configuration({ apiKey: pluginConfig.apiKey });
const openai = new OpenAIApi(configuration);

const conversationMap = new Map();
// const chatGPT = new ChatGPTAPI({
//   sessionToken: config.chatGPTSessionToken,
//   clearanceToken: config.clearanceToken,
//   userAgent: config.userAgent,
// });

async function getReply(content) {
  const { data, status } = await openai.createCompletion({
    prompt: content,
    model: 'text-davinci-003',
    temperature: 0.6,
    max_tokens: 2048,
  });
  console.log(data.choices);
  return data.choices[0].text || 'I have no idea what you are talking about.';
}

function resetConversation(contactId: string) {
  if (conversationMap.has(contactId)) {
    conversationMap.delete(contactId);
  }
}

// function getConversation(contactId: string) {
//   if (conversationMap.has(contactId)) {
//     return conversationMap.get(contactId);
//   }
//   // const conversation = chatGPT.getConversation();
//   conversationMap.set(contactId, conversation);
//   return conversation;
// }

async function getChatGPTReply(content, contactId) {
  // const currentConversation = getConversation(contactId);
  // send a message and wait for the response
  // const threeMinutesMs = 3 * 60 * 1000;
  // const response = await pTimeout(currentConversation.sendMessage(content), {
  //   milliseconds: threeMinutesMs,
  //   message: 'ChatGPT timed out waiting for response',
  // });
  // console.log('response: ', response);
  // // response is a markdown-formatted string
  // return response;
}

export async function replyMessage(contact, content, contactId) {
  try {
    if (
      content.trim().toLocaleLowerCase() === config.resetKey.toLocaleLowerCase()
    ) {
      resetConversation(contactId);
      await contact.say('Previous conversation has been reset.');
      return;
    }
    // const message = await retryRequest(
    //   () => getChatGPTReply(content, contactId),
    //   config.retryTimes,
    //   500
    // );
    let message = await getReply(content);
    message = message.trim();

    if (
      (contact.topic && contact?.topic() && config.groupReplyMode) ||
      (!contact.topic && config.privateReplyMode)
    ) {
      const result = content + '\n-----------\n' + message;
      await contact.say(result);
      return;
    } else {
      await contact.say(message);
    }
  } catch (e: any) {
    console.error(e);
    if (e.message.includes('timed out')) {
      await contact.say(
        content +
          '\n-----------\nERROR: Please try again, ChatGPT timed out for waiting response.'
      );
    }
    conversationMap.delete(contactId);
  }
}
