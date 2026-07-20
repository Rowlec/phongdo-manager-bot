require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const { BOT_TOKEN, GUILD_ID } = process.env;

if (!BOT_TOKEN || !GUILD_ID) {
  throw new Error('Thieu BOT_TOKEN hoac GUILD_ID trong file .env.');
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
const commandPayload = commands.map((command) => command.toJSON());

(async () => {
  try {
    const application = await rest.get(Routes.oauth2CurrentApplication());

    console.log(`Dang deploy ${commandPayload.length} slash command vao guild ${GUILD_ID}...`);

    await rest.put(Routes.applicationGuildCommands(application.id, GUILD_ID), {
      body: commandPayload,
    });

    console.log('Deploy slash commands thanh cong.');
  } catch (error) {
    console.error('Deploy slash commands that bai:', error);
    process.exitCode = 1;
  }
})();
