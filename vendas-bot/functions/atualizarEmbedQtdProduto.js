const { MessageEmbed, Formatters } = require('discord.js');
const config = require("../config.json");

const atualizarEmbedQtdProduto = (nome, qtd = 1) => (

    new MessageEmbed()
    .setColor(config.color)
    .setAuthor({name: `Produto: ${nome}`})
        .setDescription(`Quantidade: \`${qtd}\`\nUse os botões abaixo para **adicionar** ou **remover** produtos do carrinho.`)
);

module.exports = { atualizarEmbedQtdProduto };
