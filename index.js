const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, Events, PermissionsBitField } = require("discord.js");
const fs = require("fs");
const express = require("express");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// ==== 🔧 عدل هذه المتغيرات ==== 
const TOKEN = process.env.TOKEN; // حط التوكن في Secrets في Replit
const APPLICATIONS_CHANNEL_ID = "1407427459837722665"; // آيدي روم التقديم
const LOG_CHANNEL_ID = "1408101990470389830"; // آيدي روم اللوغ
// ==============================

// تخزين دائم للي قدموا
const DB_PATH = "./submitted.json";
let submittedUsers = new Set();
try {
  if (fs.existsSync(DB_PATH)) {
    const arr = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (Array.isArray(arr)) submittedUsers = new Set(arr);
  }
} catch (e) { console.error("DB read error:", e); }

function saveDB() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify([...submittedUsers], null, 2));
  } catch (e) {
    console.error("DB write error:", e);
  }
}

// Keep-alive server (للريبلت)
const app = express();
app.get("/", (_, res) => res.send("Bot is running."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Keep-alive server on :${PORT}`));

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "inaktif" }],
    status: "idle"
  });
});

// أمر الإعداد (يرسل رسالة زر التقديم في روم التقديم)
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.content === "!setup") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ تحتاج صلاحية **Manage Server** لاستخدام هذا الأمر.");
    }

    if (message.channel.id !== APPLICATIONS_CHANNEL_ID) {
      return message.reply(`❗ اكتب الأمر داخل روم التقديم الصحيح.`);
    }

    const button = new ButtonBuilder()
      .setCustomId("apply_button")
      .setLabel("تقديم")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const embed = new EmbedBuilder()
      .setTitle("نموذج التقديم للإدارة")
      .setDescription("اضغط زر **تقديم** لفتح الاستمارة.\n> ملاحظة: بإمكانك التقديم **مرة واحدة فقط**.")
      .setColor(0x2b6cb0)
      .setThumbnail(client.user.displayAvatarURL());

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // ضغطة زر التقديم
  if (interaction.isButton() && interaction.customId === "apply_button") {
    if (submittedUsers.has(interaction.user.id)) {
      return interaction.reply({ content: "❌ عذراً، لا يمكنك التقديم مرة أخرى.", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId("application_form")
      .setTitle("نموذج التقديم للإدارة");

    const q1 = new TextInputBuilder().setCustomId("q1").setLabel("ما اسم شخصيتك في السيرفر؟").setStyle(TextInputStyle.Short).setRequired(true);
    const q2 = new TextInputBuilder().setCustomId("q2").setLabel("كم عمرك الحقيقي؟").setStyle(TextInputStyle.Short).setRequired(true);
    const q3 = new TextInputBuilder().setCustomId("q3").setLabel("خبرتك السابقة في الإدارة (إن وجدت)").setStyle(TextInputStyle.Paragraph).setRequired(true);
    const q4 = new TextInputBuilder().setCustomId("q4").setLabel("لماذا ترغب بالانضمام إلى الطاقم الإداري؟").setStyle(TextInputStyle.Paragraph).setRequired(true);
    const q5 = new TextInputBuilder().setCustomId("q5").setLabel("نقاط قوتك وضعفك كلاعب RP").setStyle(TextInputStyle.Paragraph).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
      new ActionRowBuilder().addComponents(q4),
      new ActionRowBuilder().addComponents(q5)
    );

    await interaction.showModal(modal);
  }

  // لما العضو يرسل الاستمارة
  if (interaction.isModalSubmit() && interaction.customId === "application_form") {
    const answers = {
      q1: interaction.fields.getTextInputValue("q1"),
      q2: interaction.fields.getTextInputValue("q2"),
      q3: interaction.fields.getTextInputValue("q3"),
      q4: interaction.fields.getTextInputValue("q4"),
      q5: interaction.fields.getTextInputValue("q5"),
    };

    submittedUsers.add(interaction.user.id);
    saveDB();

    // رسالة شكر
    const applicationsChannel = interaction.guild.channels.cache.get(APPLICATIONS_CHANNEL_ID);
    if (applicationsChannel) {
      applicationsChannel.send(`✅ **${interaction.user}** شكراً لك على التقديم! تم استلام طلبك.`);
    }

    await interaction.reply({ content: "✅ شكراً لك على التقديم! سيتم مراجعة طلبك قريباً.", ephemeral: true });

    // إرسال التقديم إلى روم اللوغ
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle("📥 تقديم جديد")
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: "👤 اسم المقدم", value: `${interaction.user.tag}`, inline: true },
          { name: "🆔 آيدي", value: `${interaction.user.id}`, inline: true },
          { name: "⏰ وقت التقديم", value: `<t:${Math.floor(Date.now() / 1000)}:f>` },
          { name: "السؤال 1", value: answers.q1 || "—" },
          { name: "السؤال 2", value: answers.q2 || "—" },
          { name: "السؤال 3", value: answers.q3 || "—" },
          { name: "السؤال 4", value: answers.q4 || "—" },
          { name: "السؤال 5", value: answers.q5 || "—" }
        )
        .setColor(0x2b6cb0);

      await logChannel.send({ embeds: [embed] });
    }
  }
});

client.login(TOKEN);
