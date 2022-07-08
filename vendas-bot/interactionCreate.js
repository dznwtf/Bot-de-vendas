/* eslint-disable no-useless-escape */
// eslint-disable-next-line no-unused-vars
const { Interaction, CategoryChannel, TextChannel, Collection,
 MessageEmbed } = require('discord.js');
const {
    atualizarMsgProduto, atualizarEmbedQtdProduto,
    gerarEmbedCarrinhoDetalhes, iniciarCompra, gerarPagamento
} = require('./functions');
const { Pagamento, Produto, ProdutoEstoque, Carrinho } = require('./models/vendas');

const mercadopago = require('mercadopago');
const { accessToken } = require('./config.json');
const config = require("./config.json");

mercadopago.configure({
    access_token: accessToken
});

module.exports = {
    name: 'interactionCreate',
    /** @param {Interaction} interaction */
    async execute(interaction) {

        /** @typedef {Object} Produto
         * @property {Number} _id
         * @property {String} nome
         * @property {String} server_id
         * @property {Number} valor
         * @property {Number} quantidade
         */

        /** @typedef {Object} ProdutoEstoque
         * @property {Number} produtoId
         * @property {String} server_id
         * @property {String} conteudo
         * @property {Number} data_adicao
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

        /** @typedef {Object} MsgProduto
         * @property {String} canal_id
         * @property {String} msg_id
         * @property {String} server_id
         * @property {Number} produtoId
         */

        if (!interaction.guild) return;

        if (interaction.isButton()) {

            /** @type {CategoryChannel} */
            const categoriaCarrinho = interaction.guild.channels.cache.get(config.categoria);

            if (!categoriaCarrinho) return interaction.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
                .setAuthor({
                  name: config.nome,
                  iconURL: config.author})
                  .setColor(config.color).setDescription(`Não foi possível achar a categoria de **carrinhos** desse servidor.`)]});

            const button = interaction.customId;

            const filtroCarrinho = {
                user_id: interaction.user.id,
                server_id: interaction.guildId,
            };


            if (button.startsWith('verificar-')) {

                const [, pagamentoId ] = button.split('-');

                // Essa função ainda não está pronta

                const nao_pronto = true;
                // Caso a pessoa demore muito a pagar, essa é a verificação manual
                if (nao_pronto) return interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                    .setColor(config.color).setDescription(`Essa função **ainda** não está pronta, contacte um staff.`)]});

                const res = await mercadopago.payment.get(Number(pagamentoId));
                const pagamentoStatus = res.body.status;

                await interaction.deferUpdate();
                if (pagamentoStatus === 'approved') {

                    /** @type {Carrinho} */
                    const carrinhoDados = await Carrinho.findOne({
                        server_id: interaction.guildId,
                        user_id: interaction.user.id,
                    });

                    await Pagamento.updateOne({ _id: Number(pagamentoId) }, {
                        pagamento_confirmado: true,
                        data: res.body.date_approved
                    });


                }
            }

            if (button.startsWith('pix')) {

                iniciarCompra(interaction, categoriaCarrinho);

            }

            if (button === 'cancelar-compra') {

                await interaction.channel.bulkDelete(100, true)
                await interaction.channel.send({ content: `${interaction.user}`, embeds: [new MessageEmbed().setFooter(config.footer)
                    .setAuthor({
                      name: config.nome,
                      iconURL: config.author})
                      .setColor(config.color).setDescription(`Cancelando a compra. Esse canal irá ser **deletado** em breve.`)], ephemeral: true});
                // Lembrar de devolver os itens pro estoque após cancelar compra

                /** @type {Carrinho} */
                const carrinhoDados = await Carrinho.findOne({
                    server_id: interaction.guildId,
                    msg_carrinho_status: interaction.message.id,
                });

                if (carrinhoDados.produtos.length > 0) {

                    /** @type {Produto[]} */
                    const todosProdutos = await Produto.find({ server_id: interaction.guildId });

                    /** @type {Collection<Number,ProdutoCarrinho[]>} */
                    const categoriasProdutos = new Collection();
                    // Para separar os produtos corretamente

                    carrinhoDados.produtos.forEach(p => {
                        categoriasProdutos.get(p.produto_id)?.push(p) || categoriasProdutos.set(p.produto_id, [p]);
                    });

                    for (const [ id, produtos ] of categoriasProdutos) {

                        await ProdutoEstoque.insertMany(produtos.map(i => (
                            {
                                produtoId: i.produto_id,
                                server_id: interaction.guildId,
                                conteudo: i.produto_conteudo,
                                data_adicao: i.produto_data_adicao,
                            })
                        ));
                        const produtoAtualizar = todosProdutos.find(i => i._id === id);
                        produtoAtualizar.quantidade = await ProdutoEstoque.countDocuments(
                            {
                                server_id: interaction.guildId,
                                produtoId: id,    
                            });
                        atualizarMsgProduto(produtoAtualizar, interaction);
                    }

                }

                await Carrinho.deleteOne({
                    server_id: interaction.guildId,
                    user_id: interaction.user.id,
                });

                setTimeout(() => interaction.channel.delete().catch(() => {}), 5_000);
                
            }

            if (button === 'finalizar-compra') {

                gerarPagamento(interaction);

            }

            if (button.startsWith('adicionar_produto_')) {

                const userAbriuCarrinho = await interaction.guild.members.fetch(interaction.channel.topic);

                if (userAbriuCarrinho.id !== interaction.member.id) return interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                    .setColor(config.color).setDescription(`Este carrinho **não** é seu.`)], ephemeral: true});

                /** @type {Produto} */
                const itemEncontrado = await Produto.findOne({
                    server_id: interaction.guildId,
                    _id: Number(button.split('_')[2]),
                });

                if (!itemEncontrado) return interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                    .setColor(config.color).setDescription(`Este produto **não** foi encontrado no sistema.`)], ephemeral: true});

                const { _id, nome, valor, quantidade } = itemEncontrado;

                if (quantidade < 1) return interaction.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
                    .setAuthor({
                      name: config.nome,
                      iconURL: config.author})
                     .setColor(config.color).setDescription(`Não há mais estoque de \`${nome}\`.`)], ephemeral: true});

                await interaction.deferUpdate();

                /** @type {ProdutoEstoque} */
                const produtoEscolhido = await ProdutoEstoque.findOne({
                    server_id: interaction.guildId,
                    produtoId: _id,
                });

                const carrinhoCanal = interaction.channel;


                /** @type {Carrinho} */
                const carrinhoDados = await Carrinho.findOneAndUpdate(filtroCarrinho, {
                    $push: {
                        produtos:
                            {
                                msg_produto_id: interaction.message.id,
                                produto_id: _id,
                                produto_nome: nome,
                                produto_conteudo: produtoEscolhido.conteudo,
                                produto_valor: valor,
                                produto_data_adicao: produtoEscolhido.data_adicao,
                            }
                    },
                },
                {
                    returnDocument: 'after'
                });
                    
                /** @type {Message} */
                let msgCarrinhoStatus;
    
                try {
                    msgCarrinhoStatus = await carrinhoCanal.messages.fetch(carrinhoDados.msg_carrinho_status);
                }
                catch (error) {
                    return interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                        .setColor(config.color).setDescription(`Erro ao **processar** os dados do carrinho.`)]})
                        .catch(() => interaction.followUp({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                            .setColor(config.color).setDescription(`Erro ao **processar** os dados do carrinho.`)]}));
                }

                await ProdutoEstoque.deleteOne({
                    produtoId: _id,
                    server_id: interaction.guildId,
                    conteudo: produtoEscolhido.conteudo
                });

                console.log(carrinhoDados);

                const produtoAtualizado = await Produto.findOneAndUpdate(
                    {
                        _id,
                        server_id: interaction.guildId,
                    },
                    {
                        quantidade: quantidade - 1
                    },
                    {
                        returnDocument: 'after'
                    }
                );

                await msgCarrinhoStatus.edit({ embeds: [
                    gerarEmbedCarrinhoDetalhes(carrinhoDados.produtos
                        .map(p => (
                            { nome: p.produto_nome, valor: p.produto_valor }
                        )),
                    interaction
                    )
                ] });

                const produtosQtd = carrinhoDados.produtos.filter(p => p.msg_produto_id === interaction.message.id);

                interaction.message.edit({ embeds: [
                    atualizarEmbedQtdProduto(produtosQtd[0].produto_nome, produtosQtd.length)
                ] });

                atualizarMsgProduto(produtoAtualizado, interaction);

            }
            if (button.startsWith('remover_produto_')) {

                const userAbriuCarrinho = await interaction.guild.members.fetch(interaction.channel.topic);

                if (userAbriuCarrinho.id !== interaction.member.id) return interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                    .setColor(config.color).setDescription(`Este carrinho **não** é seu.`)], ephemeral: true});

                /** @type {Produto} */
                const itemEncontrado = await Produto.findOne({
                    server_id: interaction.guildId,
                    _id: Number(button.split('_')[2]),
                });

                if (!itemEncontrado) return interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                    .setColor(config.color).setDescription(`Este produto **não** foi encontrado no sistema.`)], ephemeral: true});

                const { _id, nome, valor } = itemEncontrado;

                await interaction.deferUpdate();

                /** @type {Carrinho} */
                let carrinhoDados = await Carrinho.findOne({
                    server_id: interaction.guildId,
                    user_id: interaction.user.id,
                    produtoId: _id,
                });

                const produtoEscolhido = carrinhoDados.produtos.find(p => p.produto_id === _id);

                carrinhoDados = await Carrinho.findOneAndUpdate(filtroCarrinho, {
                    $pull: {
                        produtos:
                            {
                                msg_produto_id: interaction.message.id,
                                produto_id: _id,
                                produto_nome: nome,
                                produto_conteudo: produtoEscolhido.produto_conteudo,
                                produto_valor: valor,
                                produto_data_adicao: produtoEscolhido.produto_data_adicao,
                            }
                    },
                },
                {
                    returnDocument: 'after'
                });

                const carrinhoCanal = interaction.channel;

                /** @type {Message} */
                let msgCarrinhoStatus;

                try {
                    msgCarrinhoStatus = await carrinhoCanal.messages.fetch(carrinhoDados.msg_carrinho_status);
                }
                catch (error) {
                    return interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                        .setColor(config.color).setDescription(`Erro ao **processar** os dados do carrinho.`)]})
                        .catch(() => interaction.followUp({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                            .setColor(config.color).setDescription(`Erro ao **processar** os dados do carrinho.`)]}));
                }


                await ProdutoEstoque.create({
                    produtoId: _id,
                    server_id: interaction.guildId,
                    conteudo: produtoEscolhido.produto_conteudo,
                    data_adicao: produtoEscolhido.produto_data_adicao,
                });

                const quantidade = await ProdutoEstoque.countDocuments({
                    server_id: interaction.guildId,
                    produtoId: _id,
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

                const produtosQtd = carrinhoDados.produtos.filter(p => p.msg_produto_id === interaction.message.id);


                await msgCarrinhoStatus.edit({ embeds: [
                    gerarEmbedCarrinhoDetalhes(carrinhoDados.produtos
                        .map(p => (
                            { nome: p.produto_nome, valor: p.produto_valor }
                        )),
                    interaction
                    )
                ] });

                if (produtosQtd.length < 1) {

                    return interaction.message.delete().catch(() => {});
                }

                interaction.message.edit({ embeds: [
                    atualizarEmbedQtdProduto(produtosQtd[0].produto_nome, produtosQtd.length)
                ] });

            }
        }
    }
};
