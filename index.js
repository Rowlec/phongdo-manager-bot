require('dotenv').config();

const express = require('express');
const {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
} = require('discord.js');
const ms = require('ms');
const { AMOUNT_OPTION_NAME, TIME_OPTION_NAME } = require('./commands');

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_DURATION = '5m';
const VALID_TIME_PATTERN = /^\d+(s|m|h|d)$/i;
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
const MAX_SET_TIMEOUT_MS = 2_147_483_647;

const {
  BOT_TOKEN,
  GUILD_ID,
  MUTE_ROLE_ID,
  TARGET_ID = '524438745772982272',
} = process.env;

if (!BOT_TOKEN || !GUILD_ID || !MUTE_ROLE_ID || !TARGET_ID) {
  throw new Error('Thieu BOT_TOKEN, GUILD_ID, MUTE_ROLE_ID hoac TARGET_ID trong file .env.');
}

app.get('/', (req, res) => {
  res.send('Bot đang chạy');
});

app.listen(PORT, () => {
  console.log(`Web server dang lang nghe tren cong ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

const muteTimers = new Map();

function parseTime(input) {
  const rawValue = (input || DEFAULT_DURATION).trim().toLowerCase();

  if (!VALID_TIME_PATTERN.test(rawValue)) {
    return null;
  }

  const durationMs = ms(rawValue);

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  return {
    durationMs,
    label: rawValue,
  };
}

async function getTargetMember(guild) {
  return guild.members.fetch(TARGET_ID);
}

async function ensureGuildInteraction(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
    await interaction.reply({
      content: 'Lenh nay chi duoc dung trong server da cau hinh.',
      ephemeral: true,
    });
    return false;
  }

  return true;
}

async function handleTimeout(interaction) {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await interaction.reply({
      content: 'Bot dang thieu quyen Moderate Members.',
      ephemeral: true,
    });
    return;
  }

  const parsedTime = parseTime(interaction.options.getString(TIME_OPTION_NAME));

  if (!parsedTime) {
    await interaction.reply({
      content: 'Vui long nhap dung dinh dang (VD: 30s, 5m, 2h).',
      ephemeral: true,
    });
    return;
  }

  if (parsedTime.durationMs > MAX_TIMEOUT_MS) {
    await interaction.reply({
      content: 'Discord chi ho tro timeout toi da 28d.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetMember = await getTargetMember(interaction.guild);
  await targetMember.timeout(parsedTime.durationMs, `timeout_phongdo by ${interaction.user.tag}`);

  await interaction.editReply(
    `Da cho <@${TARGET_ID}> ra goc dung hong gio trong ${parsedTime.label}.`,
  );
}

async function handleMute(interaction) {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await interaction.reply({
      content: 'Bot dang thieu quyen Manage Roles.',
      ephemeral: true,
    });
    return;
  }

  const parsedTime = parseTime(interaction.options.getString(TIME_OPTION_NAME));

  if (!parsedTime) {
    await interaction.reply({
      content: 'Vui long nhap dung dinh dang (VD: 30s, 5m, 2h).',
      ephemeral: true,
    });
    return;
  }

  if (parsedTime.durationMs > MAX_SET_TIMEOUT_MS) {
    await interaction.reply({
      content: 'Thoi gian mute role toi da la 24d vi gioi han bo dem cua Node.js.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetMember = await getTargetMember(interaction.guild);
  await targetMember.roles.add(MUTE_ROLE_ID, `mute_phongdo by ${interaction.user.tag}`);

  await interaction.editReply(
    `Da dan bang keo mieng <@${TARGET_ID}> trong ${parsedTime.label}.`,
  );

  const existingTimer = muteTimers.get(interaction.guildId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    try {
      const freshMember = await getTargetMember(interaction.guild);
      await freshMember.roles.remove(MUTE_ROLE_ID, 'mute_phongdo expired');
      await interaction.channel?.send('Da thao bang keo.');
    } catch (error) {
      console.error('Khong the go mute role sau khi het gio:', error);
    } finally {
      muteTimers.delete(interaction.guildId);
    }
  }, parsedTime.durationMs);

  muteTimers.set(interaction.guildId, timer);
}

async function handleUnmute(interaction) {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await interaction.reply({
      content: 'Bot dang thieu quyen Manage Roles.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetMember = await getTargetMember(interaction.guild);
  await targetMember.roles.remove(MUTE_ROLE_ID, `unmute_phongdo by ${interaction.user.tag}`);

  const existingTimer = muteTimers.get(interaction.guildId);

  if (existingTimer) {
    clearTimeout(existingTimer);
    muteTimers.delete(interaction.guildId);
  }

  await interaction.editReply(`Da thao bang keo cho <@${TARGET_ID}>.`);
}

async function handleUntimeout(interaction) {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await interaction.reply({
      content: 'Bot dang thieu quyen Moderate Members.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetMember = await getTargetMember(interaction.guild);
  await targetMember.timeout(null, `untimeout_phongdo by ${interaction.user.tag}`);

  await interaction.editReply(`Da huy timeout cho <@${TARGET_ID}>.`);
}

async function handlePurge(interaction) {
  const amount = interaction.options.getInteger(AMOUNT_OPTION_NAME) ?? 10;

  if (
    !interaction.channel ||
    interaction.channel.type === ChannelType.DM ||
    !interaction.channel.isTextBased() ||
    typeof interaction.channel.bulkDelete !== 'function'
  ) {
    await interaction.reply({
      content: 'Lenh nay chi dung duoc trong kenh text cua server.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await interaction.editReply('Bot dang thieu quyen Manage Messages.');
    return;
  }

  const fetchedMessages = await interaction.channel.messages.fetch({ limit: amount });
  const targetMessages = fetchedMessages.filter((message) => message.author.id === TARGET_ID);

  if (targetMessages.size === 0) {
    await interaction.editReply('Khong tim thay tin nhan nao cua PhongDo trong khoang da quet.');
    setTimeout(() => interaction.deleteReply().catch(() => undefined), 5_000);
    return;
  }

  const deletedMessages = await interaction.channel.bulkDelete(targetMessages, true);

  await interaction.editReply(`Da don dep ${deletedMessages.size} tin nhan cua <@${TARGET_ID}>.`);
  setTimeout(() => interaction.deleteReply().catch(() => undefined), 5_000);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot da dang nhap: ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    const isAllowedGuild = await ensureGuildInteraction(interaction);

    if (!isAllowedGuild) {
      return;
    }

    if (interaction.commandName === 'timeout_phongdo') {
      await handleTimeout(interaction);
      return;
    }

    if (interaction.commandName === 'mute_phongdo') {
      await handleMute(interaction);
      return;
    }

    if (interaction.commandName === 'unmute_phongdo') {
      await handleUnmute(interaction);
      return;
    }

    if (interaction.commandName === 'untimeout_phongdo') {
      await handleUntimeout(interaction);
      return;
    }

    if (interaction.commandName === 'purge_phongdo') {
      await handlePurge(interaction);
    }
  } catch (error) {
    console.error(`Loi khi xu ly /${interaction.commandName}:`, error);

    const response = {
      content: 'Co loi xay ra khi xu ly lenh. Kiem tra console de xem chi tiet.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: response.content }).catch(() => undefined);
    } else {
      await interaction.reply(response).catch(() => undefined);
    }
  }
});

client.login(BOT_TOKEN);
