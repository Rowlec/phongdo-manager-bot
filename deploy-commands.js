require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const { BOT_TOKEN, GUILD_ID } = process.env;

if (!BOT_TOKEN || !GUILD_ID) {
  throw new Error('Thiếu BOT_TOKEN hoặc GUILD_ID trong file .env.');
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
const commandPayload = commands.map((command) => command.toJSON());

(async () => {
  try {
    const application = await rest.get(Routes.oauth2CurrentApplication());

    console.log(`Đang deploy ${commandPayload.length} slash command vào guild ${GUILD_ID}...`);

    await rest.put(Routes.applicationGuildCommands(application.id, GUILD_ID), {
      body: commandPayload,
    });

    console.log('Slash command đã được deploy thành công.');
  } catch (error) {
    console.error('Lỗi khi deploy slash commands:', error);
    process.exitCode = 1;
  }
})();
