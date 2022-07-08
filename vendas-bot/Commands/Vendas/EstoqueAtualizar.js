/* eslint-disable no-useless-escape */
const {
    // eslint-disable-next-line no-unused-vars
    Message, MessageEmbed, MessageActionRow, MessageSelectMenu, ButtonInteraction,
    MessageButton, Modal, TextInputComponent
} = require('discord.js');
const { Produto, ProdutoEstoque, MsgProduto } = require('../../models/vendas');
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
    const itens = await Produto.find({ server_id: message.guildId });
    let itemAtual = itens.find(Boolean); // So pra pegar a tipagem

    if (itens.length < 1) return message.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author}).setColor(config.color).setDescription(`Não há produtos cadastrados no momento.\nUtilize \`${config.prefix}produtocadastrar\` para começar.`)]});

    const rowMenu = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('edicao_produtos_menu')
                .setPlaceholder('Selecionar um produto')
                .addOptions(
                    itens.map(item => (
                        {
                            label: `${item.nome} [R$ ${item.valor}]`,
                            value: `${item._id}`
                        }
                    ))
                ),
        );

    const botaoAdd = new MessageButton()
        .setLabel('Adicionar')
        .setCustomId('btn_add')
        .setStyle('SECONDARY');
    
    const rowBotoes = new MessageActionRow()
        .addComponents(
            botaoAdd,
        );

    const embedBase = new MessageEmbed()
    .setFooter(config.footer)
    .setAuthor({
      name: config.nome,
      iconURL: config.author})
    .setColor(config.color)
        .setDescription(`Produto atual: \`Nenhum\`\nSelecione algum produto no menu abaixo para configurar.`)
    const msgMenu = await message.channel.send({
        embeds: [ embedBase ],
        components: [ rowMenu ]
    });

    const coletor = message.channel.createMessageComponentCollector({
        filter: i => [ 'edicao_produtos_menu', 'btn_add', 'btn_del' ].includes(i.customId),
        idle: 5 * 60 * 1_000
    });


    coletor.on('collect', async interaction => {

        if (interaction.isSelectMenu()) {

            const [ itemId ] = interaction.values;
            const itemEscolhido = itens.find(i => `${i._id}` === itemId);

            itemAtual = itemEscolhido;

            const embed = new MessageEmbed()
            .setFooter(config.footer)
    .setAuthor({
      name: config.nome,
      iconURL: config.author})
      .setColor(config.color)
                .setDescription(
                    embedBase.description
                        .replace('Nenhum', itemEscolhido.nome)
                        .replace('Selecione algum produto no menu abaixo para configurar.', `Valor do produto: \`R$${itemAtual.valor.toFixed(2).replace('.', ',')}\`\nEstoque do produto: \`${itemAtual.quantidade}\``)
                        .replace('--', itemEscolhido.quantidade)
                );
            interaction.update({ embeds: [ embed ], components: [ rowMenu, rowBotoes ] });
            return;
        }

        ////////////////////////////////////////////
        if (interaction.customId === 'btn_add') {

            try {

                const modalInteraction = await criarModal(interaction, message);
                
                const conteudo = modalInteraction.fields.getTextInputValue('conteudo');
                
                await modalInteraction.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
                    .setAuthor({
                      name: config.nome,
                      iconURL: config.author})
                      .setColor(config.color).setDescription(`Atualizando o **estoque**, aguarde...`)], ephemeral: true });
                
                itemAtual.quantidade++;
                await ProdutoEstoque.create({
                    produtoId: itemAtual._id,
                    server_id: message.guildId,
                    conteudo
                });
                await Produto.updateOne({ _id: itemAtual._id }, { quantidade: itemAtual.quantidade });
                
                await modalInteraction.editReply({ embeds: [new MessageEmbed().setFooter(config.footer)
                    .setAuthor({
                      name: config.nome,
                      iconURL: config.author})
                      .setColor(config.color).setDescription(`Produto adicionado ao **estoque** com sucesso!`)], ephemeral: true });

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

                /** @type {{canal_id: String, msg_id: String, server_id: String, produtoId: Number}} */
                const msgProduto = await MsgProduto.findOne({ server_id: message.guildId, produtoId: itemAtual._id });

                if (!msgProduto) return;

                /** @type {TextChannel} */
                const canal = message.guild.channels.cache.get(msgProduto.canal_id);
                if (!canal) console.log('Canal de atualizar estoque de não encontrado')

                canal.messages.fetch(msgProduto.msg_id)
                    .then(async m => {
                        await m.edit({ embeds: [embed] });
                        console.log('Mensagem de estoque de produto atualizada com sucesso')
                    })
                    .catch(() => console.log('Erro ao atualizar mensagem de estoque de produt'));

            }
            catch(err) {
                console.log(err);
            }
        }
        ////////////////////////////////////////////
        else if (interaction.customId === 'btn_del') {


            itemAtual;
        }
        ////////////////////////////////////////////

    });

    coletor.on('end', () => {

        msgMenu.delete();
    });
};

/** @param { ButtonInteraction } interaction */
const criarModal = async (interaction, message) => {

    const modal = new Modal()
        .setCustomId('novo_item')
        .setTitle('Adicionando Estoque');

    const conteudoInput = new TextInputComponent()
        .setCustomId('conteudo')
        .setLabel('Produto:')
        .setRequired(true)
        .setStyle('PARAGRAPH');

    modal.addComponents(
        new MessageActionRow().addComponents(conteudoInput),
    );
    
    await interaction.showModal(modal);

    return await interaction.awaitModalSubmit({ filter: interaction => interaction.user.id === message.author.id, time: 120_000 });
};


module.exports = {	
    run,
    name: 'estoque',
};
