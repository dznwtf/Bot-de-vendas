// eslint-disable-next-line no-unused-vars
const { MessageEmbed, MessageActionRow, MessageButton, ButtonInteraction } = require('discord.js');
const { Carrinho } = require('../models/vendas');
const { gerarEmbedCarrinhoDetalhes } = require('./gerarEmbedCarrinhoDetalhes');
const config = require("../config.json");

/** @param {ButtonInteraction} interaction */
const criarCarrinho = async (categoriaCarrinho, interaction) => {

    const filtroCarrinho = {
        user_id: interaction.user.id,
        server_id: interaction.guildId,
    };



    const carrinhoCanal = await interaction.guild.channels.create(`🛒・carrinho-${interaction.user.tag}`, {
        parent: config.categoria,
        topic: interaction.user.id,
        permissionOverwrites: [
            {
                id: interaction.guildId,
                deny: [ 'VIEW_CHANNEL' ],
            },
            {
                id: interaction.user.id,
                allow: [ 'VIEW_CHANNEL', 'SEND_MESSAGES' ]
            },
        ],
    });

    const msgCarrinhoStatus = await carrinhoCanal.send({ content: `${interaction.user}`

        , embeds: [
            gerarEmbedCarrinhoDetalhes(null, interaction)
        ] ,

        components: [
            new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setLabel('Finalizar Compra')
                        .setStyle('SECONDARY')
                        .setCustomId('finalizar-compra'),
                    new MessageButton()
                        .setLabel('Cancelar')
                        .setStyle('SECONDARY')
                        .setCustomId('cancelar-compra'),
                )
        ]

    });

    await Carrinho.updateOne(
        { ...filtroCarrinho },
        {
            ...filtroCarrinho,
            msg_carrinho_status: msgCarrinhoStatus.id,
            produtos: []
        },
        {
            upsert: true
        }
    );

    return carrinhoCanal;
};

module.exports = { criarCarrinho };
