/* eslint-disable no-useless-escape */
// eslint-disable-next-line no-unused-vars
const { Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, TextChannel } = require('discord.js');
const config = require("../../config.json");

/**
* @param { Message } message
* @param { string[] } args
*/
const run = async (client, message, args) => {

    if (message.author.id !== config.owner)
      return message.reply({ embeds: [new Discord.MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
        .setColor(config.color).setDescription(`Este comando está disponível apenas para o **dono** do bot.`)]});
    else {

    let BotaoNome = new MessageButton()
    .setLabel("Alterar Nome")
    .setStyle("SECONDARY")
    .setCustomId("botalterarnome")

    let BotaoAvatar = new MessageButton()
    .setLabel("Alterar Avatar")
    .setStyle("SECONDARY")
    .setCustomId("alteraravatar")

    let Row = new MessageActionRow()
    .addComponents(BotaoNome, BotaoAvatar, )


    let Config = await message.reply({ embeds: [new MessageEmbed()    .setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
        .setColor(config.color).setThumbnail(message.author.displayAvatarURL({dynamyc: true}))
        .setDescription(`Painel de **Configuração**:\nCom os botões abaixo você pode alterar:\n\`nome e avatar do bot.\` `)], components: [Row]})


      const AvaliarColetor = Config.createMessageComponentCollector({
        componentType: "BUTTON",
      });
  
      AvaliarColetor.on("collect", async (interaction) => {
        if (message.author.id != interaction.user.id) { 
            return;
        }
        if (interaction.customId === "botalterarnome") {
            let Nome = await interaction.reply({ content: `${interaction.user}`, embeds: [new MessageEmbed()
                .setAuthor({
                  name: config.nome,
                  iconURL: config.author})
                .setColor(config.color).setDescription(`Envie aqui nesse canal o novo **nome** do bot.`)]})

            const collector = message.channel.createMessageCollector({ filter: mm => mm.author.id == message.author.id, max: 1 });

            collector.on('collect', async m => {

                let nome = m.content;
                if (nome.length > 32)  {
                    return message.reply({embeds: [new MessageEmbed()
                        .setAuthor({
                          name: config.nome,
                          iconURL: config.author})
                        .setColor(config.color).setDescription(`Este nome ultrapassa os **32 caracteres**, diminua e tente novamente.`)]}).then((message) => setTimeout(() => message.delete(), 3000));
                } 

                await m.delete()
                await interaction.editReply({ content: `${interaction.user}`, embeds: [new MessageEmbed()
                        .setAuthor({
                          name: config.nome,
                          iconURL: config.author})
                        .setColor(config.color).setDescription(`Nome editado com **sucesso** para \`${m.content}\`.`)]}).then((message) => setTimeout(() => message.delete(), 8000));
                    client.user.setUsername(nome);
                    
                })
        }
        if (interaction.customId === "alteraravatar") {
            let Avatar = await interaction.reply({ content: `${interaction.user}`, embeds: [new MessageEmbed()
                .setAuthor({
                  name: config.nome,
                  iconURL: config.author})
                .setColor(config.color).setDescription(`Envie aqui o link de uma imagem para ser o **avatar** do bot.`)]})
    
                const collector = message.channel.createMessageCollector({ filter: mm => mm.author.id == message.author.id, max: 1 });
    
                    collector.on('collect', async m => {
                        await m.delete()
                        await interaction.editReply({ content: `${interaction.user}`, embeds: [new MessageEmbed()
                            .setAuthor({
                              name: config.nome,
                              iconURL: config.author})
                            .setColor(config.color).setDescription(`Avatar alterado com **sucesso** para [avatar](${m.content}).`)]}).then((message) => setTimeout(() => message.delete(), 8000));
                        client.user.setAvatar(m.content);
                    
                            })

        }
    })
}

}
module.exports = {	
    run,
    name: 'botconfig',
    aliases: ["configbot", "botnome", "botavatar", "botconfig", "botprefixo", "configurarbot"],
};
