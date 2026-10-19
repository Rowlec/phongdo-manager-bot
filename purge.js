const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

async function purgeTargetMessages(channel, targetId, amount, before) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    throw new RangeError('Số lượng tin nhắn phải từ 1 đến 100.');
  }

  const targets = [];
  while (targets.length < amount) {
    const page = await channel.messages.fetch({ limit: 100, before, cache: false });
    if (page.size === 0) break;

    // Discord returns messages newest first; the cursor excludes newer arrivals.
    for (const message of page.values()) {
      if (message.author.id === targetId) targets.push(message);
      if (targets.length === amount) break;
    }

    before = page.last().id;
    if (page.size < 100) break;
  }

  // Leave a margin so messages near the age limit use individual deletion.
  const cutoff = Date.now() - TWO_WEEKS_MS + 60_000;
  const recent = targets.filter((message) => message.createdTimestamp > cutoff);
  const individual = targets.filter((message) => message.createdTimestamp <= cutoff);
  let deletedCount = 0;

  try {
    if (recent.length > 1) {
      const deleted = await channel.bulkDelete(recent);
      deletedCount += deleted.size;
    } else {
      individual.unshift(...recent);
    }

    for (const message of individual) {
      try {
        await channel.messages.delete(message.id);
        deletedCount += 1;
      } catch (error) {
        // A message removed by someone else is not a successful deletion by us.
        if (error.code !== 10008) throw error;
      }
    }
  } catch (error) {
    return { deletedCount, matchedCount: targets.length, error };
  }

  return { deletedCount, matchedCount: targets.length, error: null };
}

module.exports = { purgeTargetMessages };
