const { MessageButton, MessageActionRow, MessageEmbed } = require('discord.js');
const { Produto, ProdutoEstoque, Carrinho } = require('../models/vendas');
const { criarCarrinho } = require('./criarCarrinho');
const { atualizarMsgProduto } = require('./atualizarMsgProduto');
const { atualizarEmbedQtdProduto } = require('./atualizarEmbedQtdProduto');
const { gerarEmbedCarrinhoDetalhes } = require('./gerarEmbedCarrinhoDetalhes');
const config = require("../config.json");

/** @typedef {Object} ProdutoEstoque
 * @property {Number} produtoId
 * @property {String} server_id
 * @property {String} conteudo
 * @property {Number} data_adicao
 */

/** @typedef {Object} Produto
 * @property {Number} _id
 * @property {String} nome
 * @property {String} server_id
 * @property {Number} valor
 * @property {Number} quantidade
 */

/** @typedef {Object} ProdutoCarrinho
 * @property {String} msg_produto_id
 * @property {Number} produto_id
 * @property {String} produto_nome
 * @property {String} produto_conteudo
 * @property {Number} produto_valor
 * @property {Number} produto_data_adicao
 */

/** @typedef {Object} Carrinho
 * @property {String} server_id
 * @property {String} user_id
 * @property {String} msg_carrinho_status
 * @property {ProdutoCarrinho[]} produtos
 */

const iniciarCompra = async (interaction, categoriaCarrinho) => {

    const filtroCarrinho = {
        user_id: interaction.user.id,
        server_id: interaction.guildId,
    };

    /** @type {Produto[]} */
    const itens = await Produto.find({ server_id: interaction.guildId });

    if (itens.length < 1) return interaction.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
          .setColor(config.color).setDescription(`Nenhum produto cadastrado no **banco de dados** do bot.`)], ephemeral: true});

    const produtoId = Number(interaction.customId.split('-')[1]);

    const itemEncontrado = itens.find(obj => obj._id === produtoId);

    if (!itemEncontrado) return interaction.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
          .setColor(config.color).setDescription(`Este produto **não** encontra-se mais cadastrado no bot.`)], ephemeral: true});

    const { nome, valor, _id } = itemEncontrado;

    /** @type {ProdutoEstoque} */
    const produtoEscolhido = await ProdutoEstoque.findOne({ produtoId: _id, server_id: interaction.guildId });
    
    if (!produtoEscolhido) return interaction.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
         .setColor(config.color).setDescription(`Não há mais estoque de \`${nome}\`. Volte novamente mais tarde!`)], ephemeral: true});
    
    await interaction.deferUpdate();
    
    /** @type {TextChannel} */
    const carrinhoCanal = categoriaCarrinho.children
        .find(c => c.topic === interaction.user.id) || await criarCarrinho(categoriaCarrinho, interaction);


    const produtoNoCarrinho = await Carrinho.findOne(
        {
            ...filtroCarrinho,
            'produtos.produto_id': { $eq: _id }
        }
    );


    if (produtoNoCarrinho) return interaction.followUp({ embeds: [new MessageEmbed().setFooter(config.footer)
        .setAuthor({
          name: config.nome,
          iconURL: config.author})
          .setColor(config.color).setDescription(`Este produto **já** encontra-se em seu carrinho. Adicione mais dele aqui: ${carrinhoCanal}.`)], ephemeral: true});
    
    // Impedir adicionar o mesmo produto no carrinho
    const msgProduto = await carrinhoCanal.send({
    
        embeds: [
            atualizarEmbedQtdProduto(nome)
        ],
    
        components: [
            new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setLabel('➕')
                        .setStyle('SECONDARY')
                        .setCustomId(`adicionar_produto_${_id}`),
                    new MessageButton()
                        .setLabel('➖')
                        .setStyle('SECONDARY')
                        .setCustomId(`remover_produto_${_id}`),
                )
        ]
    
    });
    
    
    /** @type {Carrinho} */
    const carrinhoDados = await Carrinho.findOneAndUpdate(filtroCarrinho, {
        $push: {
            produtos: [
                {
                    msg_produto_id: msgProduto.id,
                    produto_id: _id,
                    produto_nome: nome,
                    produto_conteudo: produtoEscolhido.conteudo,
                    produto_valor: valor,
                    produto_data_adicao: produtoEscolhido.data_adicao,
                }],
        },
    },
    {
        returnDocument: 'after'
    }
    );
    
    await ProdutoEstoque.deleteOne({
        produtoId: _id,
        server_id: interaction.guildId,
        conteudo: produtoEscolhido.conteudo,
    });
    
    const quantidade = await ProdutoEstoque.countDocuments({
        produtoId: _id,
        server_id: interaction.guildId,
    });
    
    const produtoAtualizado = await Produto.findOneAndUpdate(
        {
            _id,
            server_id: interaction.guildId,
        },
        {
            quantidade
        },
        {
            returnDocument: 'after'
        }
    );

    await atualizarMsgProduto(produtoAtualizado, interaction);

    let msgCarrinhoStatus;

    try {

        msgCarrinhoStatus = await carrinhoCanal.messages.fetch(carrinhoDados.msg_carrinho_status);

    }
    catch (error) {

        return carrinhoCanal.send({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
        .setColor(config.color).setDescription(`Erro ao **processar** os dados do carrinho.`)]});

    }

    await msgCarrinhoStatus.edit({ embeds: [
        gerarEmbedCarrinhoDetalhes(carrinhoDados.produtos.map(p => (
            { nome: p.produto_nome, valor: p.produto_valor }
        )), interaction)
    ] });


};

module.exports = { iniciarCompra };
