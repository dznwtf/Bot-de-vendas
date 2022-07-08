// eslint-disable-next-line no-unused-vars
const { ButtonInteraction, MessageAttachment, MessageEmbed, MessageButton, MessageActionRow } = require('discord.js');
const { Buffer }  = require('buffer');
const { Pagamento, Carrinho } = require('../models/vendas');
const mercadopago = require('mercadopago');
const { accessToken } = require('../config.json');
const config = require("../config.json");

mercadopago.configure({
    access_token: accessToken
});

/** @typedef {Object} ProdutoCarrinho
 * @property {String} msg_produto_id
 * @property {Number} produto_id
 * @property {String} produto_nome
 * @property {String} produto_conteudo
 * @property {Number} produto_valor
 */

/** @typedef {Object} Carrinho
 * @property {String} server_id
 * @property {String} user_id
 * @property {String} msg_carrinho_status
 * @property {ProdutoCarrinho[]} produtos
 */

/**
 * @param {ButtonInteraction} interaction
 */
const gerarPagamento = async (interaction) => {


    const canalLogsCompras = interaction.guild.channels.cache.get(config.logs); // Coloca id do seu canal de compras


    try {

        /** @type {Carrinho} */
        const carrinhoDados = await Carrinho.findOne({
            server_id: interaction.guildId,
            user_id: interaction.user.id,
        });


        const quantidade = carrinhoDados.produtos.length;

        if (quantidade < 1) return interaction.reply({ embeds: [new MessageEmbed().setFooter(config.footer)
            .setAuthor({
              name: config.nome,
              iconURL: config.author})
              .setColor(config.color).setDescription(`Não **há** nada no carrinho para eu gerar o pagamento.`)], ephemeral: true })
            .then(() => {

                setTimeout(() => {
                    interaction.deleteReply();
                }, 10_000);
            });


        const valor = carrinhoDados.produtos
            .map(p => p.produto_valor * 100)
            .reduce((acc, curr) => acc + curr) / 100;

        const nomesProdutos = [...new Set(carrinhoDados.produtos
            .map(p => p.produto_nome)) ].join(' | ');

        const conteudoProdutos = carrinhoDados.produtos
            .sort((a, b) => a.produto_id - b.produto_id)
            .map((produto, index) => `${index + 1} ${produto.produto_conteudo}`);


        const aguardandoPagamentoRow = interaction.message.components[0];
        
        aguardandoPagamentoRow.components[0]
            .setLabel('Aguardando Pagamento')
            .setDisabled(true);


        await interaction.update({ components: [ aguardandoPagamentoRow ] });

        const idMsgsProduto = carrinhoDados.produtos.map(p => p.msg_produto_id);

        const msgsProduto = (await interaction.channel.messages.fetch())
            .filter(msg => idMsgsProduto.includes(msg.id));


        interaction.channel.bulkDelete(msgsProduto).catch(() => {});


        const msgsApagar = [];

        const email = 'emailquaquer@sla.com'; // Email qualquer aqui

        const payment_data = {
            transaction_amount: valor,
            description: nomesProdutos,
            payment_method_id: 'pix',
            payer: {
                email,
                first_name: `${interaction.user.tag} (${interaction.user.id})`,
            }
        };


        const data = await mercadopago.payment.create(payment_data);                    
        const base64_img = data.body.point_of_interaction.transaction_data.qr_code_base64;

        const buf = Buffer.from(base64_img, 'base64');
        const attachment = new MessageAttachment(buf, 'qrcode.png');

        const embedQR = new MessageEmbed()
        .setFooter(config.footer)
                .setAuthor({
                  name: config.nome,
                  iconURL: config.author})
                  .setColor(config.color)
            .setDescription(
                `**PIX** gerado no valor de \`R$${payment_data.transaction_amount}\`\nUse o **QRCode** abaixo para pagar.\nOu aperte no botão para receber o Código Copia e Cola.`)
            .setImage('attachment://qrcode.png');


            await Pagamento.create({
                _id: parseInt(data.body.id),
                server_id: interaction.guildId,
                user_id: interaction.user.id,
                pagamento_confirmado: false,
            });


        const rowCopiaCola = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setLabel('Copia e Cola')
                    .setStyle('SECONDARY')
                    .setCustomId('botao_copia_cola')
            );


        interaction.followUp({
            embeds: [ embedQR ],
            files: [ attachment ],
            fetchReply: true,
            components: [ rowCopiaCola ]
        }).then(m => msgsApagar.push(m.id));


        const coletorCopiaCola = interaction.channel.createMessageComponentCollector(
            {
                componentType: 'BUTTON',
                time: 10 * 60 * 1000,
                filter: i => i.user.id === interaction.user.id && i.customId === 'botao_copia_cola',
            });


        coletorCopiaCola.on('collect', async i => {

            i.channel.send({ embeds: [ new MessageEmbed().setAuthor({ name: `Código Copia e Cola`})
            .setColor(config.color).setDescription(`${data.body.point_of_interaction.transaction_data.qr_code}`)]}).then(m => msgsApagar.push(m.id));

            rowCopiaCola.components[0].setDisabled(true);

            await i.update({ components: [] });

        });

        let tentativas = 0;
        const interval = setInterval(async () => {
            // Verificando se foi pago automaticamente
            // console.log('tentativa: ', tentativas+1);
            tentativas++;

            const res = await mercadopago.payment.get(data.body.id);
            const pagamentoStatus = res.body.status;

            if (tentativas >= 8 || pagamentoStatus === 'approved') {

                clearInterval(interval);

                if (pagamentoStatus === 'approved') {

                    aguardandoPagamentoRow.components[0]
                        .setStyle('SECONDARY')
                        .setLabel('Pagamento Aprovado');

                    aguardandoPagamentoRow.components.splice(1, 1);


                    interaction.message.edit({ components: [
                        aguardandoPagamentoRow
                    ] });


                    interaction.channel.bulkDelete(msgsApagar).catch(() => {});

                    canalLogsCompras
                    ?.send({
                        embeds: [
                            new MessageEmbed()
                            .setThumbnail(interaction.guild.iconURL({dynamyc: true}))
                            .setFooter(config.footer)
                            .setAuthor({
                            name: `Pagamento Aprovado`,
                            iconURL: config.author})
                            .setColor(config.color)
                            .addFields(
                                {
                                    name: `Produto(s):`,
                                    value: `\`${nomesProdutos}\``,
                                    inline: true
                                },
                                {
                                    name: `Preço:`,
                                    value: `\`R$${valor}\``,
                                    inline: true
                                },
                                {
                                    name: `Quantidade:`,
                                    value: `\`${quantidade}\``,
                                    inline: false
                                },
                                {
                                    name: `Cliente:`,
                                    value: `\`${interaction.user.tag}\` [${interaction.user.id}]`,
                                    inline: false
                                },
                                {
                                    name: `Horário da Compra:`,
                                    value: `<t:${~~(Date.now(1) / 1000)}:f>`,
                                    inline: false
                                },

                            )
                        ]
                    });


                    await Pagamento.updateOne({ _id: Number(data.body.id) }, {
                        pagamento_confirmado: true,
                        data: res.body.date_approved,
                        quantidade_produtos_vendidos: quantidade,
                        valor,
                    });


                    const tamanhoConteudo = conteudoProdutos.join('\n').length;

                    if (tamanhoConteudo < 2000) {

                        interaction.channel.send({ embeds: [new MessageEmbed().setFooter(config.footer)
                            .setAuthor({
                              name: config.nome,
                              iconURL: config.author})
                              .setColor(config.color).setDescription(`**${interaction.user.username}**, pagamento recebido, seu produto:\n\`\`\`${conteudoProdutos.join('\n')}\`\`\``)]})
                            .then(async () => {
                                await Carrinho.deleteOne({
                                    server_id: interaction.guildId,
                                    user_id: interaction.member.id
                                });
                                await interaction.channel.setTopic(`CARRINHO DESATIVADO DE: ${interaction.user.tag}`);
                            }
                            );
                        return;
                    }

                    // Entrega de produtos que ultrapassem 2048 caracteres do Discord NÂO TESTADA

                    const [ conteudoSeparadoP1, conteudoSeparadoP2 ] = [
                        conteudoProdutos.slice(0, conteudoProdutos.length / 2),
                        conteudoProdutos.slice(conteudoProdutos.length / 2)
                    ];

                    await interaction.channel.send(conteudoSeparadoP1.join('\n'));
                    interaction.channel.send(conteudoSeparadoP2.join('\n'))
                        .then(async () => {
                            await Carrinho.deleteOne({ server_id: interaction.guildId, user_id: interaction.member.id });
                            await interaction.channel.setTopic(`CARRINHO DESATIVADO DE: ${interaction.user.tag}`);
                        })
                        .catch(() => interaction.reply({ embeds: [ new MessageEmbed().setAuthor({ name: config.nome})
                        .setColor(config.color).setDescription(`Erro ao **entregar** o seu produto, contacte um staff.`)]}));


                }

                else if (pagamentoStatus !== 'approved') {
                    interaction.reply({  embeds: [ new MessageEmbed().setFooter(config.footer)
                        .setAuthor({
                          name: config.nome,
                          iconURL: config.author})
                          .setColor(config.color).setDescription(`Seu produto ainda não foi **entregue**?\nUse o botão abaixo para verificar manualmente.`)]
                        , components: [
                            new MessageActionRow()
                                .addComponents(
                                    new MessageButton()
                                        .setCustomId(`verificar-${data.body.id}`)
                                        .setStyle('SECONDARY')
                                        .setLabel('Verificar')
                                )
                        ]
                    });
                }


            }
        }, 30_000);

    }
    catch (error) {
        
        interaction.reply({  embeds: [ new MessageEmbed().setFooter(config.footer)
            .setAuthor({
              name: config.nome,
              iconURL: config.author})
              .setColor(config.color).setDescription(`Ocorreu um erro ao **processar** os dados.`)]});
        console.log(error);
    }

};

module.exports = { gerarPagamento };
