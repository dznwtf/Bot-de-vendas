/* eslint-disable no-useless-escape */
const { MessageEmbed } = require('discord.js');
const { MsgProduto } = require('../models/vendas');
const config = require("../config.json");

/** @typedef {Object} Produto
 * @property {Number} _id
 * @property {String} nome
 * @property {String} server_id
 * @property {Number} valor
 * @property {Number} quantidade
 */

/**
 * Função que atualiza o número de itens disponíveis no estoque
 * @param {Produto} itemAtual
 */
const atualizarMsgProduto = async (itemAtual, interaction) => {
    const embed = new MessageEmbed()
    .setThumbnail(interaction.guild.iconURL({dynamyc: true}))
    .setFooter(config.footer)
    .setAuthor({
      name: config.nome,
      iconURL: config.author})
      .setColor(config.color)
        .setDescription(
            `\`\`\`\ ${itemAtual.nome}\`\`\`\n`+
            `💵 » Preço: \`R$${itemAtual.valor}\`\n📦 » Quantidade disponível: \`${itemAtual.quantidade}\``
        );

    /** @type {MsgProduto}*/
    const msgProduto = await MsgProduto.findOne({ server_id: interaction.guildId, produtoId: itemAtual._id });

    if (!msgProduto) return;

    /** @type {TextChannel} */
    const canal = interaction.guild.channels.cache.get(msgProduto.canal_id);
    if (!canal) return interaction.followUp({ embeds: [new MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
          .setColor(config.color).setDescription(`Não achei a mensagem de estoque do produto **${itemAtual.nome}**.\nEntão não consegui editá-la.`)], ephemeral: true });

    canal.messages.fetch(msgProduto.msg_id)
        .then(async m => {
            await m.edit({ embeds: [embed] });
            console.log('Mensagem de estoque de produto atualizada com sucesso');
        })
        .catch(() => console.log('Erro ao atualizar mensagem de estoque de produto'));
};

module.exports = { atualizarMsgProduto };
