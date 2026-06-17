import type { Wechaty } from 'wechaty';

export async function listRooms(bot: Wechaty) {
  const rooms = await bot.Room.findAll();
  const result: Array<{ id: string; topic: string }> = [];
  for (const room of rooms) {
    result.push({ id: room.id, topic: await room.topic() });
  }
  return result;
}

export async function listFriends(bot: Wechaty) {
  const contacts = await bot.Contact.findAll();
  const result: Array<{ id: string; name: string; alias: string }> = [];
  for (const c of contacts) {
    if (c.type() !== bot.Contact.Type.Individual) continue;
    if (!c.friend()) continue;
    result.push({
      id: c.id,
      name: c.name(),
      alias: (await c.alias()) || '',
    });
  }
  return result;
}
