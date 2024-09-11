require('dotenv').config(); //initializes dotenv
const {Client, GatewayIntentBits, ChannelType, SlashCommandBuilder, PermissionFlagsBits, Collection, Events} = require('discord.js'); //imports discord.js
const OpenAI = require("openai");
const fs = require("fs");

const openai = new OpenAI();
const discord = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
]});

const activeThreads = new Map();
const activeChannels = new Map();

const ASSISTANT = process.env.UNFAIR_ID;

// Start the bot
discord.on('ready', () => {
    console.log(`Logged in as ${discord.user.tag}!, guilds: ${discord.guilds.cache.map(guild => guild.id) }`);
    loadBackups();
});

discord.on('messageCreate', async msg => {
  const user = discord.users.cache.get(msg.author.id);

  // console.log (activeChannels.has(user.id) + " " + activeChannels.get(user.id) + " " + activeThreads.get(user.id));
  
  if (activeChannels.has(user.id) &&
              activeChannels.get(user.id) === msg.channel.id && activeThreads.has(user.id)
              && msg.content.length > 0) {
    // Very "hacky" solution but fuck it we ball I guess
    // Check if the message was sent in an active channel
    // console.log(msg.channel.id + " " + msg.author.id);
    // console.log("active channel detected. Generating a response");
    // userIds should? be unique
    cId = activeChannels.get(user.id)
    // Get the thead id
    threadId = activeThreads.get(user.id);

    const message = await openai.beta.threads.messages.create(threadId,
      {
        role : "user",
        content : msg.content
      }
    );

    await getRun(threadId, cId);
  }
});

// Track events
discord.on('interactionCreate', (interaction) => {
    if (!interaction.isCommand()) {
        return;
    }
    if (interaction.commandName === 'ping') {
        interaction.reply({content: "pong!", ephemeral: true});
    }

    if (interaction.commandName === 'start') {
        start(interaction);
        interaction.reply({content: "Adventure has been started!", ephemeral: true});
    }

    if (interaction.commandName === 'reset') {
        reset(interaction.user);
        interaction.reply({content: "Resetting... please wait", ephemeral: true});
    }

    if (interaction.commandName === 'solve') {
        solve(interaction);
    }
});

//this line must be at the very end
discord.login(process.env.CLIENT_TOKEN); //signs the bot in with token

async function start(msg) {
    user = msg.user;
    // console.log("Start triggered!");
    // Build the AI helper
    const userThread = await openai.beta.threads.create()
    const message = await openai.beta.threads.messages.create(userThread.id,
      {
        role : "user",
        content : "Let's begin the adventure!"
      }
    );

    // Start the challenge
    // Create the valid channel
    msg.guild.channels.create({
      name: user.globalName,
      type: ChannelType.GuildText,
      parent: msg.channel.parent,
      permissionOverwrites: [
        {
          id: msg.guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: discord.user.id,
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ],
    }).then(channel => {
      // TODO: LOG THE CHANNEL CHANGE
      channel.setRateLimitPerUser(10 /* To allow for gpt to generate a response */, "Don't fuck up");
      // console.log("Channel created");
      // Afterwards, get the Discord run used
      channel.send("Welcome! Please wait as we generate your adventure...");
      getRun(userThread.id, channel.id);
  
      // Store the user's thread ID
      activeThreads.set(user.id , userThread.id);
      activeChannels.set(user.id, channel.id);
      // console.log("Stored " + channel.id + " " + user.id);

      // back up the challenge
      backup(user.id, userThread.id, channel.id)
    });
}

async function solve(interaction) {
    let option = interaction.options.get("flag").value;

    if (option === process.env.FLAG) {
        // Add user to relavent channel
        interaction.reply({content: "Congrats! You successfully solved the challenge!", ephemeral: true});
    } else {
        interaction.reply({content: "Incorrect flag, please try again", ephemeral: true});
    }
}
  
async function reset(user) {
    // TODO: LOG THE RESET CHANGE
    id = user.id;
    if (activeThreads.has(user.id)) {
        ch = await discord.channels.fetch(activeChannels.get(user.id));
        
        const userThread = await openai.beta.threads.create()
        const message = await openai.beta.threads.messages.create(userThread.id,
        {
            role : "user",
            content : "Let's begin the adventure!"
        }
        );

        getRun(userThread.id, ch.id);

        activeThreads.set(user.id , userThread.id);
        backup(id, userThread.id)
    }
}
  
async function getRun(thread_id, cId) {
    const channel = await discord.channels.fetch(cId)
    // console.log(channel);
    // Can't have it reply by username because it breaks the whole AI for no fucking reason
    let reply = "";
    const run = openai.beta.threads.runs.stream(thread_id, {
      assistant_id: ASSISTANT,
    })
    .on('textDelta', (textDelta, snapshot) => {
      if (reply.length + textDelta.value.length >= 1950) {
        channel.send(reply + "\n (cont'd)");
        reply = "";
      }
      reply += textDelta.value
    }).on('end', () => {
        if (reply.length > 0) {
          channel.send(reply);
        } else {
          channel.send("Reply was 0 characters long. This should never happen, but is usually a problem with OpenAI API. Please send your message again.");
        }
      }
    );  
}

async function backup(userId, threadId, channelId = activeChannels.get(userId)) {
    const content = threadId + " " + channelId;
    fs.writeFile(`${process.env.LOGS}/${userId}` , content, err => {
      if (err) {
        console.error(err);
      }
    });
}

async function loadBackups() {
  fs.readdir(process.env.LOGS, (err, userIds) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }
    
    userIds.forEach(userId => {
      fs.readFile(`${process.env.LOGS}/${userId}`, {encoding: 'utf-8'}, (err, data) => {
        vals = data.split(" ")
        if (err) {
          console.error(err);
          return;
        } else if (vals.length == 2) {
          th = vals[0];   
          ch = vals[1];

          activeChannels.set(userId, ch);
          activeThreads.set(userId, th);
        }
      })
    });
  });
}