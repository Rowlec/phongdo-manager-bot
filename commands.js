const { SlashCommandBuilder } = require('discord.js');

const TIME_OPTION_NAME = 'thoi_gian';
const AMOUNT_OPTION_NAME = 'so_luong';

const commands = [
  new SlashCommandBuilder()
    .setName('timeout_phongdo')
    .setDescription('Cho PhongDo timeout trong một khoản thời gian.')
    .addStringOption((option) =>
      option
        .setName(TIME_OPTION_NAME)
        .setDescription('Thời gian: 30s, 5m, 2h, 1d. Mac dinh: 5m.')
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('mute_phongdo')
    .setDescription('Mute phong đỗ.')
    .addStringOption((option) =>
      option
        .setName(TIME_OPTION_NAME)
        .setDescription('Thời gian: 30s, 5m, 2h, 1d. Mac dinh: 5m.')
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName('unmute_phongdo')
    .setDescription('Gỡ mute phong đỗ.'),
  new SlashCommandBuilder()
    .setName('untimeout_phongdo')
    .setDescription('Hủy timeout của PhongDo ngay lập tức.'),
  new SlashCommandBuilder()
    .setName('purge_phongdo')
    .setDescription('Xóa tin nhắn gần đây của PhongDo trong kênh hiện tại.')
    .addIntegerOption((option) =>
      option
        .setName(AMOUNT_OPTION_NAME)
        .setDescription('Số tin nhắn gần đây cần xóa. Mac định: 10.')
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
