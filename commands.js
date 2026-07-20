const { SlashCommandBuilder } = require('discord.js');

const TIME_OPTION_NAME = 'thoi_gian';
const AMOUNT_OPTION_NAME = 'so_luong';

const commands = [
  new SlashCommandBuilder()
    .setName('timeout_phongdo')
    .setDescription('Cho PhongDo timeout trong mot khoang thoi gian.')
    .addStringOption((option) =>
      option
        .setName(TIME_OPTION_NAME)
        .setDescription('Thoi gian: 30s, 5m, 2h, 1d. Mac dinh: 5m.')
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('mute_phongdo')
    .setDescription('Gan mute role cho PhongDo trong mot khoang thoi gian.')
    .addStringOption((option) =>
      option
        .setName(TIME_OPTION_NAME)
        .setDescription('Thoi gian: 30s, 5m, 2h, 1d. Mac dinh: 5m.')
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('unmute_phongdo')
    .setDescription('Go mute role khoi PhongDo ngay lap tuc.'),
  new SlashCommandBuilder()
    .setName('untimeout_phongdo')
    .setDescription('Huy timeout cua PhongDo ngay lap tuc.'),
  new SlashCommandBuilder()
    .setName('purge_phongdo')
    .setDescription('Xoa tin nhan gan day cua PhongDo trong kenh hien tai.')
    .addIntegerOption((option) =>
      option
        .setName(AMOUNT_OPTION_NAME)
        .setDescription('So tin nhan gan day can quet. Mac dinh: 10.')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false),
    ),
];

module.exports = {
  AMOUNT_OPTION_NAME,
  TIME_OPTION_NAME,
  commands,
};
