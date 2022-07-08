/* eslint-disable no-useless-escape */
// eslint-disable-next-line no-unused-vars
const { Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, TextChannel } = require('discord.js');
const { Produto, MsgProduto, ProdutoEstoque } = require('../../models/vendas');
const config = require("../../config.json");


/**
* @param { Message } message
* @param { string[] } args
*/
const run = async (client, message) => {

    
    if (message.author.id !== config.owner) {
        return;
    }


    /** @type {{ _id: Number, nome: String, server_id: String, valor: Number, quantidade: Number }[]} */
    const produtos = await Produto.find({ server_id: message.guildId });

    if (produtos.length < 1) return message.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
    .setAuthor({
      name: config.nome,
      iconURL: config.author}).setColor(config.color).setDescription(`Não há produtos cadastrados no momento.\nUtilize \`${config.prefix}produtocadastrar\` para começar.`)]});


      const embedBase = new MessageEmbed()
      .setFooter(config.footer)
      .setAuthor({
        name: config.nome,
        iconURL: config.author})
        .setColor(config.color)
          .setDescription(`Selecione um produto no **menu** abaixo.\nAssim enviando o painel de compra neste canal.`)

          const menuRow = new MessageActionRow()
          .addComponents(
              new MessageSelectMenu()
                  .setCustomId('menu_produtos')
                  .setPlaceholder('Selecionar um produto')
                  .addOptions(produtos
                      .map(produto => ({
  
                          label: `${produto.nome} [R$${produto.valor}]`,
                          value: `${produto._id}`,
                      })
                      )
                  )
          );

    const msgMenu = await message.channel.send({ components: [menuRow], embeds: [embedBase]});

    const menuCollector = message.channel.createMessageComponentCollector({
        filter: i => i.customId === 'menu_produtos',
        componentType: 'SELECT_MENU',
        max: 1,
        idle: 120_000
    });

    menuCollector.on('collect', async i => {

        const itemSelecionado = produtos.find(p => `${p._id}` === i.values[0]);

        // console.log(itemSelecionado);

        const filtroBuscaProduto = {
            produtoId: itemSelecionado._id,
            server_id: message.guildId
        };

        itemSelecionado.quantidade = await ProdutoEstoque.countDocuments(filtroBuscaProduto);

        await Produto.updateOne(filtroBuscaProduto, { quantidade: itemSelecionado.quantidade });

        const embed = new MessageEmbed()
        .setThumbnail(message.guild.iconURL({dynamyc: true}))
        .setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
          .setColor(config.color)
            .setDescription(
                `\`\`\`\ ${itemSelecionado.nome}\`\`\`\n`+
                `💵 » Preço: \`R$${itemSelecionado.valor}\`\n📦 » Quantidade disponível: \`${itemSelecionado.quantidade}\``
            );


            const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setStyle('SECONDARY')
                    .setEmoji('<:pix_branco:989990687036551199>')
                    .setCustomId(`pix-${itemSelecionado._id}`)
                    .setLabel('Comprar')
            );

        const filtroBuscaMsg = { produtoId: itemSelecionado._id, server_id: message.guildId };

        /** @type {{canal_id: String, msg_id: String, server_id: String, produtoId: Number}} */
        const msgProduto = await MsgProduto.findOne(filtroBuscaMsg);

        await i.deferUpdate();

        if (msgProduto) {

            try {
                /** @type {TextChannel} */
                const canal = message.guild.channels.cache.get(msgProduto.canal_id);
                const msgRegistrada = await canal?.messages.fetch(msgProduto.msg_id);

                await i.followUp({ embeds: [new MessageEmbed().setFooter(config.footer)
                .setAuthor({
                  name: config.nome,
                  iconURL: config.author}).setColor(config.color).setDescription(`Esse produto já está em algum canal.\nClique **[aqui](${msgRegistrada.url})** para ser direcionado á ele.`)], ephemeral: true});
                await msgMenu.delete();
                return;
            }
            catch (error) {

                await i.followUp({ embeds: [new MessageEmbed().setFooter(config.footer)
                .setAuthor({
                  name: config.nome,
                  iconURL: config.author}).setColor(config.color).setDescription(`Tentei procurar pela mensagem desse produto na database mas **não** encontrei.\nUse o comando novamente.`)], ephemeral: true});
                await MsgProduto.deleteOne(filtroBuscaMsg);
                await msgMenu.delete().catch(() => {});
                return;
            }

        }

        const msgProdutoFinal = await message.channel.send({ components: [row], embeds: [embed] });

        await MsgProduto.create({
            canal_id: message.channelId,
            msg_id: msgProdutoFinal.id,
            server_id: message.guildId,
            produtoId: itemSelecionado._id,
        });

        await i.followUp({ embeds: [new MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author}).setColor(config.color).setDescription(`Mensagem cadastrada com sucesso em <#${message.channel.id}>.`)], ephemeral: true});
        await msgMenu.delete();
        await message.delete()


    });

};


module.exports = {	
    run,
    name: 'exibirproduto',
    aliases: ["criar", "mostrarproduto", "exibirproduto", "pcriar"],
};
