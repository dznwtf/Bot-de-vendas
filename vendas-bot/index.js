const { Client, Intents, Collection } = require("discord.js");
const { connect } = require('mongoose')



const Discord = require("discord.js");
const client = new Discord.Client({
  intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_VOICE_STATES,
      Intents.FLAGS.GUILD_PRESENCES,
      Intents.FLAGS.GUILD_MEMBERS
  ]
});
const logs = require('discord-logs');
logs(client, {
    debug: true
}); 
const config = require("./config.json");
connect(config?.mongo_url || process.env.mongo_url).then(() => console.log('Conectado ao MongoDB'))
const cooldowns = new Map();
module.exports = client;

client.login(config.token);

client.once("ready", async () => {

  console.log(`🎄 » [APLICAÇÃO] Online.\n🤖 » [DEV] døne#0001.`);
});

const fs = require("fs");

client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
client.categories = fs.readdirSync(`./Commands/`);

fs.readdirSync("./Commands/").forEach((local) => {
  const comandos = fs
    .readdirSync(`./Commands/${local}`)
    .filter((arquivo) => arquivo.endsWith(".js"));

  for (let file of comandos) {
    let puxar = require(`./Commands/${local}/${file}`);

    if (puxar.name) {
      client.commands.set(puxar.name, puxar);
    }
    if (puxar.aliases && Array.isArray(puxar.aliases))
      puxar.aliases.forEach((x) => client.aliases.set(x, puxar.name));
  }
});


///RODAR COMANDOS
client.on("messageCreate", async (message) => {
  if (message.author.bot || message.channel.type == "DM") return;


  let prefix = config.prefix;

  if (
    message.content == `<@${client.user.id}>` ||
    message.content == `<@!${client.user.id}>`
  ) {

  }

  if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) return;

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);

  const cooldown = cooldowns;

  const now = Date.now();
  const timestamps = cooldown.get(message.author.id);
  const cooldownAmount = 3000;

  if (timestamps && cooldown.has(message.author.id)) {
    const expirationTime = cooldown.get(message.author.id) + cooldownAmount;

    let embedcd = new Discord.MessageEmbed()
    .setFooter("∙ discord.gg/serenys ©")
    .setAuthor({
      name: `Serenys`,
      iconURL: config.author})
    .setColor(config.color)
      .setDescription(
        `Você deve **aguardar** alguns segundos para usar um comando denovo.`
      );

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
    }
  }

  if (!cooldown.has(message.author.id)) {
    cooldown.set(message.author.id, Date.now());

    setTimeout(() => {
      cooldown.delete(message.author.id);
    }, cooldownAmount);
  }

  let cmd = args.shift().toLowerCase();
  if (cmd.length === 0) return;
  let command = client.commands.get(cmd);
  if (!command) command = client.commands.get(client.aliases.get(cmd));

  try {
    command.run(client, message, args);
  } catch (err) {
    console.error("🚨 » [ERRO] " + err);
  }
});

////STATUS
client.on("ready", () => {

  let activities = [`» Vendas automáticas.`, `» Recebendo pagamentos.`],
    i = 0;
  setInterval(
    () =>
      client.user.setActivity(`${activities[i++ % activities.length]}`, {
        type: "PLAYING",
      }),
    15000
  );
  client.user.setStatus("online");
});


///ANTI-CRASH
process.on("multipleResolves", (type, reason, promise) => {
  console.log(`🚨 » [ERRO]\n\n` + type, promise, reason);
});
process.on("unhandRejection", (reason, promise) => {
  console.log(`🚨 » [ERRO]\n\n` + reason, promise);
});
process.on("uncaughtException", (error, origin) => {
  console.log(`🚨 » [ERRO]\n\n` + error, origin);
});
process.on("uncaughtExceptionMonitor", (error, origin) => {
  console.log(`🚨 » [ERRO] \n\n` + error, origin);
});

client.on('interactionCreate', require('./interactionCreate').execute)