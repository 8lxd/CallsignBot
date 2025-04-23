import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, ActivityType } from 'discord.js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ]
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CALLSIGNS_FILE = path.join(__dirname, '../data/callsigns.json');
const COOLDOWNS_FILE = path.join(__dirname, '../data/cooldowns.json');
const COOLDOWN_TIME = (parseInt(process.env.CALLSIGN_COOLDOWN) || 30) * 60 * 1000;

// Status configuration
const statuses = [
  {
    type: ActivityType.Custom,
    message: 'Managing Callsigns'
  },
  {
    type: ActivityType.Watching,
    message: 'over Angeltown FivePD'
  }
];

let currentStatusIndex = 0;

function updateStatus() {
  const status = statuses[currentStatusIndex];
  client.user.setActivity(status.message, { type: status.type });
  currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
}

// Change the NAME and Format only if needed, I deadass DONT feel like sitting here and making this eazy :) goodluck -- Kidding I'll update it soon don't know when tho. 

const departments = {
  LAPD: {
    name: 'LAPD',
    format: 'Number Letter Number Number Number'
  },
  LASD: {
    name: 'LASD',
    format: 'Number Letter Number Number Number'
  },
  CHP: {
    name: 'CHP',
    format: 'Number Number Letter Number Number Number'
  }
};

async function ensureDataDir() {
  const dataDir = path.join(__dirname, '../data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

async function loadCallsigns() {
  try {
    const data = await fs.readFile(CALLSIGNS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveCallsigns(callsigns) {
  await fs.writeFile(CALLSIGNS_FILE, JSON.stringify(callsigns, null, 2));
}

async function loadCooldowns() {
  try {
    const data = await fs.readFile(COOLDOWNS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveCooldowns(cooldowns) {
  await fs.writeFile(COOLDOWNS_FILE, JSON.stringify(cooldowns, null, 2));
}

async function isCallsignClaimed(callsign) {
  const callsigns = await loadCallsigns();
  
  for (const userId in callsigns) {
    if (callsigns[userId].callsign === callsign) {
      const expiryTime = new Date(callsigns[userId].expiryTime);
      if (expiryTime > new Date()) {
        return true;
      }
    }
  }
  
  return false;
}

async function isUserOnCooldown(userId) {
  const cooldowns = await loadCooldowns();
  
  if (cooldowns[userId]) {
    const cooldownEnd = new Date(cooldowns[userId]);
    if (cooldownEnd > new Date()) {
      const remainingTime = Math.ceil((cooldownEnd - new Date()) / (60 * 1000));
      return remainingTime;
    }
  }
  
  return false;
}

async function setUserCooldown(userId) {
  const cooldowns = await loadCooldowns();
  const cooldownEnd = new Date(Date.now() + COOLDOWN_TIME);
  cooldowns[userId] = cooldownEnd.toISOString();
  await saveCooldowns(cooldowns);
}

function validateCallsign(callsign, department) {
  if (department === 'LAPD' || department === 'LASD') {
    return /^[0-9][A-Za-z][0-9][0-9][0-9]$/.test(callsign);
  } else if (department === 'CHP') {
    return /^[0-9][0-9][A-Za-z][0-9][0-9][0-9]$/.test(callsign);
  }
  return false;
}

async function setCallsign(userId, callsign, department, roleplayName) {
  const callsigns = await loadCallsigns();
  const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  callsigns[userId] = {
    callsign,
    department,
    roleplayName,
    expiryTime: expiryTime.toISOString()
  };
  
  await saveCallsigns(callsigns);
  return expiryTime;
}

async function updateNickname(interaction, callsign, roleplayName) {
  try {
    const member = interaction.member;
    if (!member) return false;
    
    const newNickname = `${callsign} ${roleplayName}`;
    
    if (newNickname.length <= 32) {
      await member.setNickname(newNickname);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating nickname:', error);
    return false;
  }
}

async function checkExpiredCallsigns() {
  const callsigns = await loadCallsigns();
  const now = new Date();
  
  for (const [userId, data] of Object.entries(callsigns)) {
    const expiryTime = new Date(data.expiryTime);
    if (expiryTime <= now) {
      client.guilds.cache.forEach(async (guild) => {
        try {
          const member = await guild.members.fetch(userId);
          if (member) {
            await member.setNickname(data.roleplayName);
          }
        } catch (error) {
          console.error(`Error updating nickname for user ${userId} in guild ${guild.id}:`, error);
        }
      });
      
      delete callsigns[userId];
    }
  }
  
  await saveCallsigns(callsigns);
}

function createCallsignEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Law Enforcement Callsign Registration')
    .setDescription('Select your department and register your callsign. Choose wisely as this will be your identifier for the next 24 hours.')
    .addFields(
      { name: 'Cooldown Period', value: `You must wait ${COOLDOWN_TIME / (60 * 1000)} minutes between changing callsigns.` },
      { name: 'Expiration', value: 'Your callsign will expire after 24 hours, and you must choose a different one.' },
      { name: 'Format', value: 'Your name will appear as: `3B123 John Doe`' }
    )
    .setFooter({ text: 'Select your department below' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('department_LAPD')
        .setLabel('LAPD')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('department_LASD')
        .setLabel('LASD')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('department_CHP')
        .setLabel('CHP')
        .setStyle(ButtonStyle.Danger)
    );

  return { embed, row };
}

async function createServerInfoEmbed() {
  const serverIP = process.env.SERVER_IP || 'Not configured';
  const serverPort = process.env.SERVER_PORT || 'Not configured';
  
  const playerCount = 'N/A';
  
  const embed = new EmbedBuilder()
    .setColor(0x2E3440)
    .setTitle('Game Server Status')
    .setDescription('Welcome to our roleplay server. Below are the connection details and current status.')
    .addFields(
      { 
        name: 'Connection Details', 
        value: `\`\`\`\nServer: ${serverIP}\nPort: ${serverPort}\n\`\`\``,
        inline: false 
      },
      { 
        name: 'Current Players', 
        value: playerCount,
        inline: true 
      },
      { 
        name: 'Server Status', 
        value: 'Online',
        inline: true 
      },
      {
        name: 'Connection Instructions',
        value: '1. Copy the server IP and port\n2. Launch your game\n3. Press F8 to open the console\n4. Enter the connection details\n5. Connect to the server',
        inline: false
      }
    )
    .setTimestamp()
    .setFooter({ text: 'Last Updated' });
  
  return embed;
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('callsignembed')
      .setDescription('Display callsign selection embed')
      .addStringOption(option => 
        option.setName('channel')
          .setDescription('Channel to send the embed to')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    new SlashCommandBuilder()
      .setName('server')
      .setDescription('Display server information'),

    new SlashCommandBuilder()
      .setName('callsigncooldownreset')
      .setDescription('Reset callsign cooldown for a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('The user to reset cooldown for')
          .setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('callsignremove')
      .setDescription('Remove a user\'s callsign')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('The user to remove callsign from')
          .setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ];

  try {
    console.log('Started refreshing application (/) commands.');
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

async function removeCallsign(userId) {
  const callsigns = await loadCallsigns();
  if (callsigns[userId]) {
    delete callsigns[userId];
    await saveCallsigns(callsigns);
    return true;
  }
  return false;
}

async function resetCooldown(userId) {
  const cooldowns = await loadCooldowns();
  if (cooldowns[userId]) {
    delete cooldowns[userId];
    await saveCooldowns(cooldowns);
    return true;
  }
  return false;
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await ensureDataDir();
  await registerCommands();
  
  // Initialize status
  updateStatus();
  
  // Update status every 30 seconds
  setInterval(updateStatus, 30000);
  
  // Check for expired callsigns every minute
  setInterval(checkExpiredCallsigns, 60000);
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      
      if (commandName === 'callsigncooldownreset') {
        if (!interaction.member.permissions.has('Administrator')) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const reset = await resetCooldown(targetUser.id);

        if (reset) {
          return interaction.reply({ content: `Successfully reset cooldown for ${targetUser.tag}.`, ephemeral: true });
        } else {
          return interaction.reply({ content: `${targetUser.tag} does not have an active cooldown.`, ephemeral: true });
        }
      }
      
      else if (commandName === 'callsignremove') {
        if (!interaction.member.permissions.has('Administrator')) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const removed = await removeCallsign(targetUser.id);

        if (removed) {
          const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
          if (member) {
            await member.setNickname(null).catch(() => null);
          }
          return interaction.reply({ content: `Successfully removed callsign for ${targetUser.tag}.`, ephemeral: true });
        } else {
          return interaction.reply({ content: `${targetUser.tag} does not have an active callsign.`, ephemeral: true });
        }
      }
      
      else if (commandName === 'callsignembed') {
        if (!interaction.member.permissions.has('ManageMessages')) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        
        const channelOption = interaction.options.getString('channel');
        let targetChannel = interaction.channel;
        
        if (channelOption) {
          const channelId = channelOption.replace(/[<#>]/g, '');
          const foundChannel = interaction.guild.channels.cache.get(channelId);
          
          if (foundChannel && foundChannel.isTextBased()) {
            targetChannel = foundChannel;
          } else {
            return interaction.reply({ content: 'Invalid channel specified.', ephemeral: true });
          }
        }
        
        const { embed, row } = createCallsignEmbed();
        await targetChannel.send({ embeds: [embed], components: [row] });
        
        return interaction.reply({ content: `Callsign embed sent to ${targetChannel}.`, ephemeral: true });
      }
      
      else if (commandName === 'server') {
        const serverEmbed = await createServerInfoEmbed();
        return interaction.reply({ embeds: [serverEmbed] });
      }
    }
    
    else if (interaction.isButton()) {
      if (interaction.customId.startsWith('department_')) {
        const department = interaction.customId.split('_')[1];
        
        const modal = {
          title: `${departments[department].name} Registration`,
          custom_id: `callsign_modal_${department}`,
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'callsign_input',
                label: `Enter your ${department} callsign:`,
                style: 1,
                min_length: 5,
                max_length: 6,
                placeholder: department === 'CHP' ? '11A789' : '3A123',
                required: true
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'roleplay_name',
                label: 'Enter your roleplay name:',
                style: 1,
                min_length: 2,
                max_length: 25,
                placeholder: 'John Doe',
                required: true
              }]
            }
          ]
        };
        
        await interaction.showModal(modal);
      }
    }
    
    else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('callsign_modal_')) {
        const department = interaction.customId.split('_')[2];
        const callsign = interaction.fields.getTextInputValue('callsign_input');
        const roleplayName = interaction.fields.getTextInputValue('roleplay_name');
        
        const cooldownRemaining = await isUserOnCooldown(interaction.user.id);
        if (cooldownRemaining) {
          return interaction.reply({ 
            content: `You are on cooldown. You can set a new callsign in ${cooldownRemaining} minutes.`, 
            ephemeral: true 
          });
        }
        
        if (!validateCallsign(callsign, department)) {
          return interaction.reply({ 
            content: `Invalid callsign format. ${department} format should be: ${departments[department].format}`, 
            ephemeral: true 
          });
        }
        
        if (await isCallsignClaimed(callsign)) {
          return interaction.reply({ 
            content: 'This callsign is already claimed by another officer. Please choose a different one.', 
            ephemeral: true 
          });
        }
        
        const expiryTime = await setCallsign(interaction.user.id, callsign, department, roleplayName);
        const nicknameUpdated = await updateNickname(interaction, callsign, roleplayName);
        await setUserCooldown(interaction.user.id);
        
        const expiryTimeString = expiryTime.toLocaleString();
        
        let responseMessage = `Your callsign has been set to ${callsign} with roleplay name ${roleplayName}. It will expire on ${expiryTimeString}.`;
        if (!nicknameUpdated) {
          responseMessage += '\nWarning: Could not update your nickname. This may be due to permissions or nickname length limitations.';
        }
        
        return interaction.reply({ content: responseMessage, ephemeral: true });
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ 
        content: 'An error occurred while processing your request. Please try again later.', 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: 'An error occurred while processing your request. Please try again later.', 
        ephemeral: true 
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);