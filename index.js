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
const COMMAND_ERROR_MESSAGE =
  'Bị lỗi rồi! Hình như tôi không đủ quyền hoặc mục tiêu có Role cao hơn tôi.';
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

app.get('/', (req, res) => {
  res.send('Bot đang chạy');
});

const server = app.listen(PORT, () => {
  console.log(`Web server đang lang nghe trên cổng ${PORT}`);
});

server.on('error', (error) => {
  console.error('Lỗi web server:', error);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

const muteTimers = new Map();

async function replyCommandError(interaction) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: COMMAND_ERROR_MESSAGE });
      return;
    }

    await interaction.reply({
      content: COMMAND_ERROR_MESSAGE,
      ephemeral: true,
    });
  } catch (replyError) {
    console.error('Không thể gửi thông báo lỗi về Discord:', replyError);
  }
}

function logMissingEnv() {
  const missingEnvVars = [];

  if (!BOT_TOKEN) missingEnvVars.push('BOT_TOKEN');
  if (!GUILD_ID) missingEnvVars.push('GUILD_ID');
  if (!MUTE_ROLE_ID) missingEnvVars.push('MUTE_ROLE_ID');
  if (!TARGET_ID) missingEnvVars.push('TARGET_ID');

  if (missingEnvVars.length > 0) {
    console.error(`Thiếu biến môi trường: ${missingEnvVars.join(', ')}.`);
    console.error('Web server vẫn chạy, nhưng Discord bot có thể không hoạt động đúng.');
  }
}

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
      content: 'Lệnh này chỉ được sử dụng trong server đã cấu hình.',
      ephemeral: true,
    });
    return false;
  }

  return true;
}

async function handleTimeout(interaction) {
  try {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await interaction.reply({
      content: 'Bot đang thiếu quyền Moderate Members.',
      ephemeral: true,
    });
    return;
  }

  const parsedTime = parseTime(interaction.options.getString(TIME_OPTION_NAME));

  if (!parsedTime) {
    await interaction.reply({
      content: 'Vui lòng nhập đúng định dạng (VD: 30s, 5m, 2h).',
      ephemeral: true,
    });
    return;
  }

  if (parsedTime.durationMs > MAX_TIMEOUT_MS) {
    await interaction.reply({
        content: 'Discord chỉ hỗ trợ tối đa 28d.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetMember = await getTargetMember(interaction.guild);
  await targetMember.timeout(parsedTime.durationMs, `timeout_phongdo by ${interaction.user.tag}`);

  await interaction.editReply(
    `Đã cho <@${TARGET_ID}> ra góc đứng chờ trong ${parsedTime.label}.`,
  );
  } catch (error) {
    console.error('Lỗi khi timeout:', error);
    await replyCommandError(interaction);
  }
}

async function handleMute(interaction) {
  try {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await interaction.reply({
      content: 'Bot đang thiếu quyền Manage Roles.',
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
      content: 'Thời gian mute role tối đa là 24d vì giới hạn bộ nhớ của Node.js.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetMember = await getTargetMember(interaction.guild);
  await targetMember.roles.add(MUTE_ROLE_ID, `mute_phongdo by ${interaction.user.tag}`);

  await interaction.editReply(
    `Đã đan băng keo miệng <@${TARGET_ID}> trong ${parsedTime.label}.`,
  );

  const existingTimer = muteTimers.get(interaction.guildId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    try {
      const freshMember = await getTargetMember(interaction.guild);
      await freshMember.roles.remove(MUTE_ROLE_ID, 'mute_phongdo expired');
      await interaction.channel?.send('Đã tháo băng keo.');
    } catch (error) {
      console.error('Lỗi: Không thể gỡ mute role sau khi hết giờ:', error);
    } finally {
      muteTimers.delete(interaction.guildId);
    }
  }, parsedTime.durationMs);

  muteTimers.set(interaction.guildId, timer);
  } catch (error) {
    console.error('Lỗi khi mute:', error);
    await replyCommandError(interaction);
  }
}

async function handleUnmute(interaction) {
  try {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    await interaction.reply({
      content: 'Bot đang thiếu quyền Manage Roles.',
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

  await interaction.editReply(`Đã tháo băng keo cho <@${TARGET_ID}>.`);
  } catch (error) {
    console.error('Lỗi khi unmute:', error);
    await replyCommandError(interaction);
  }
}

async function handleUntimeout(interaction) {
  try {
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await interaction.reply({
      content: 'Bot đang thiếu quyền Moderate Members.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetMember = await getTargetMember(interaction.guild);
  await targetMember.timeout(null, `untimeout_phongdo by ${interaction.user.tag}`);

  await interaction.editReply(`Đã hủy timeout cho <@${TARGET_ID}>.`);
  } catch (error) {
    console.error('Lỗi khi hủy timeout:', error);
    await replyCommandError(interaction);
  }
}

async function handlePurge(interaction) {
  try {
  const amount = interaction.options.getInteger(AMOUNT_OPTION_NAME) ?? 10;

  if (
    !interaction.channel ||
    interaction.channel.type === ChannelType.DM ||
    !interaction.channel.isTextBased() ||
    typeof interaction.channel.bulkDelete !== 'function'
  ) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng được trong kênh text của server.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await interaction.editReply('Bot đang thiếu quyền Manage Messages.');
    return;
  }

  const fetchedMessages = await interaction.channel.messages.fetch({ limit: amount });
  const targetMessages = fetchedMessages.filter((message) => message.author.id === TARGET_ID);

  if (targetMessages.size === 0) {
    await interaction.editReply('Không tìm thấy tin nhắn nào mới nhất của Phong Đỗ.');
    setTimeout(() => interaction.deleteReply().catch(() => undefined), 5_000);
    return;
  }

  const deletedMessages = await interaction.channel.bulkDelete(targetMessages, true);

  await interaction.editReply(`Đã dọn ${deletedMessages.size} tin nhắn sủa dơ của <@${TARGET_ID}>.`);
  setTimeout(() => interaction.deleteReply().catch(() => undefined), 5_000);
  } catch (error) {
    console.error('Lỗi khi dọn tin nhắn:', error);
    await replyCommandError(interaction);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot da dang nhap: ${readyClient.user.tag}`);
});

client.on('error', (error) => {
  console.error('Lỗi Discord client:', error);
});

client.on('shardError', (error) => {
  console.error('Lỗi kết nối Discord gateway:', error);
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
      content: 'Đã có lỗi xảy ra khi xử lý lệnh, vui lòng kiểm tra console để xem chi tiết.',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: response.content }).catch(() => undefined);
    } else {
      await interaction.reply(response).catch(() => undefined);
    }
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

logMissingEnv();

if (BOT_TOKEN) {
  client.login(BOT_TOKEN).catch((error) => {
    console.error('Lỗi đăng nhập discord bot:', error);
  });
} else {
  console.error('Lỗi: Không thể đăng nhập Discord bot vì thiếu BOT_TOKEN.');
}
