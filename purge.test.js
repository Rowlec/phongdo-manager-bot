const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { purgeTargetMessages } = require('./purge');

function mockChannel(messages, deleteError) {
  const calls = { fetch: [], bulk: [], individual: [] };
  return {
    calls,
    messages: {
      async fetch(options) {
        calls.fetch.push(options);
        const eligible = messages.filter((message) => BigInt(message.id) < BigInt(options.before));
        return new Collection(eligible.slice(0, options.limit).map((message) => [message.id, message]));
      },
      async delete(id) {
        if (deleteError) throw deleteError;
        calls.individual.push(id);
      },
    },
    async bulkDelete(batch) {
      calls.bulk.push(...batch.map((message) => message.id));
      return new Collection(batch.map((message) => [message.id, message]));
    },
  };
}

function message(id, authorId = 'target', ageDays = 0) {
  return { id: String(id), author: { id: authorId }, createdTimestamp: Date.now() - ageDays * 86_400_000 };
}

test('finds the requested target count across pages with other authors interleaved', async () => {
  const history = Array.from({ length: 250 }, (_, i) => message(500 - i, i % 20 === 0 ? 'target' : 'other'));
  const channel = mockChannel(history);
  const result = await purgeTargetMessages(channel, 'target', 10, '501');
  assert.equal(result.deletedCount, 10);
  assert.equal(result.matchedCount, 10);
  assert.equal(channel.calls.fetch.length, 2);
  assert.equal(channel.calls.fetch[1].before, '401');
  assert.deepEqual(channel.calls.bulk, ['500', '480', '460', '440', '420', '400', '380', '360', '340', '320']);
});

test('deletes old messages individually and reports insufficient history', async () => {
  const channel = mockChannel([message(9), message(8), message(7, 'target', 15), message(6, 'other')]);
  const result = await purgeTargetMessages(channel, 'target', 10, '10');
  assert.equal(result.deletedCount, 3);
  assert.equal(result.matchedCount, 3);
  assert.deepEqual(channel.calls.bulk, ['9', '8']);
  assert.deepEqual(channel.calls.individual, ['7']);
});

test('a request for one deletes only the latest target message before the command', async () => {
  const channel = mockChannel([message(11), message(9, 'other'), message(8), message(7)]);
  const result = await purgeTargetMessages(channel, 'target', 1, '10');
  assert.equal(result.deletedCount, 1);
  assert.deepEqual(channel.calls.bulk, []);
  assert.deepEqual(channel.calls.individual, ['8']);
});

test('empty history does not attempt deletion', async () => {
  const channel = mockChannel([message(9, 'other')]);
  assert.deepEqual(await purgeTargetMessages(channel, 'target', 5, '10'), {
    deletedCount: 0, matchedCount: 0, error: null,
  });
  assert.deepEqual(channel.calls.bulk, []);
  assert.deepEqual(channel.calls.individual, []);
});

test('reports the completed count when individual deletion fails after a bulk delete', async () => {
  const error = Object.assign(new Error('Missing permissions'), { code: 50013 });
  const channel = mockChannel([message(9), message(8), message(7, 'target', 15)], error);
  const result = await purgeTargetMessages(channel, 'target', 3, '10');
  assert.equal(result.deletedCount, 2);
  assert.equal(result.error, error);
});

test('does not count a message already deleted by someone else', async () => {
  const channel = mockChannel([message(9, 'target', 15)], { code: 10008 });
  const result = await purgeTargetMessages(channel, 'target', 1, '10');
  assert.equal(result.deletedCount, 0);
  assert.equal(result.error, null);
});

test('rejects amounts outside the slash command limits before fetching', async () => {
  const channel = mockChannel([]);
  for (const amount of [0, 101, 1.5]) {
    await assert.rejects(purgeTargetMessages(channel, 'target', amount, '10'), RangeError);
  }
  assert.deepEqual(channel.calls.fetch, []);
});
