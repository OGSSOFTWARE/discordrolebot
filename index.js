require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { fetch } = require('undici');

const USED_INVOICES_PATH = path.join(__dirname, 'used_invoices.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

function getUsedInvoices() {
  if (!fs.existsSync(USED_INVOICES_PATH)) return [];
  return JSON.parse(fs.readFileSync(USED_INVOICES_PATH));
}

function saveUsedInvoice(id) {
  const used = getUsedInvoices();
  used.push(id);
  fs.writeFileSync(USED_INVOICES_PATH, JSON.stringify(used, null, 2));
}

client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId === 'redeem_button') {
    const modal = new ModalBuilder()
      .setCustomId('redeem_modal')
      .setTitle('Enter Your Invoice ID');

    const invoiceInput = new TextInputBuilder()
      .setCustomId('invoice_id')
      .setLabel('SellAuth Invoice ID')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(invoiceInput);
    modal.addComponents(row);
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'redeem_modal') {
    const invoiceId = interaction.fields.getTextInputValue('invoice_id');
    console.log(`🔍 User entered invoice ID: ${invoiceId}`);

    const used = getUsedInvoices();
    if (used.includes(invoiceId)) {
      return await interaction.reply({
        content: '⚠️ This invoice has already been redeemed.',
        ephemeral: true
      });
    }

    try {
      const url = `https://api.sellauth.com/v1/shops/${process.env.SHOP_ID}/invoices`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.SELLAUTH_API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      const raw = await response.text();
      console.log('📦 Raw SellAuth response:', raw);

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.status}`);
      }

      const data = JSON.parse(raw);
      const invoice = data.data.find(inv => inv.unique_id === invoiceId.trim());

      if (!invoice) {
        return await interaction.reply({ content: '❌ Invoice not found.', ephemeral: true });
      }

      if (invoice.status !== 'completed') {
        return await interaction.reply({ content: '⏳ This invoice is not completed yet.', ephemeral: true });
      }

      const role = interaction.guild.roles.cache.get(process.env.CLIENT_ROLE_ID);
      if (!role) {
        return await interaction.reply({ content: '⚠️ "Client" role not found.', ephemeral: true });
      }

      await interaction.member.roles.add(role);
      saveUsedInvoice(invoiceId);

      await interaction.reply({
        content: '✅ Invoice verified. You have been given the Client role!',
        ephemeral: true
      });
    } catch (err) {
      console.error('❌ Error verifying invoice:', err);
      await interaction.reply({
        content: '❌ An error occurred while checking your invoice. Please try again later.',
        ephemeral: true
      });
    }
  }
});

client.on('ready', async () => {
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const channel = guild.channels.cache.get(process.env.REDEEM_CHANNEL_ID);
  if (!channel) return console.log('❌ Redeem channel not found.');

  const embed = new EmbedBuilder()
    .setTitle('Get Premium Access - Reedem Youre Purchase')
    .setURL('https://ogsware.com/')
    .setDescription(`
Redeem your **Invoice ID** to instantly receive the Client Role. Unlock access to exclusive giveaways, private chat channels, and other premium features – fast, secure, and hassle-free.

<:diamond_yellow:1381704004991586405> **Premium Client Benefits**
<:YellowDot:1381703990781415424> **Exclusive Giveaways**- Entry to high-value prize events  
<:YellowDot:1381703990781415424> **Private Chat Access**- Join members-only discussions  
<:YellowDot:1381703990781415424> **More Features**- Enjoy ongoing client-only upgrades

<:diamond_yellow:1381704004991586405> **Quick & Secure Redemption**
<:YellowDot:1381703990781415424> **Instant Assignment**- Applied right after validation  
<:YellowDot:1381703990781415424> **Simple Process**- Just enter your Invoice ID  
<:YellowDot:1381703990781415424> **Trusted System**- Secure and reliable role delivery
`)
    .setColor('#FFFF00')
    .setImage('https://media.discordapp.net/attachments/1376632471260762112/1376632582149640212/G23FX56.gif?ex=684fbdc0&is=684e6c40&hm=035406d63e33600ac39ef807d29ab0a6ace81e63acb0c6394fa88fd396a72a17&=')
    .setFooter({
      text: 'OGSWare | © 2025 Copyright. All Rights Reserved.',
      iconURL: 'https://media.discordapp.net/attachments/1376632471260762112/1376632582590173315/IMG_3328.gif?ex=684fbdc0&is=684e6c40&hm=6aa0cbf9e2bd899970c2367c674550803be49ccd096b0f6e02964a428cc31f2b&=&width=864&height=864'
    });

  const button = new ButtonBuilder()
    .setCustomId('redeem_button')
    .setLabel('Redeem Invoice ID')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(button);
  await channel.send({ embeds: [embed], components: [row] });
  console.log('Redeem message sent.');
});

client.login(process.env.DISCORD_TOKEN);
