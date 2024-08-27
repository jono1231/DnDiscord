require('dotenv').config(); //initializes dotenv
const {Client, GatewayIntentBits, ChannelType, PermissionFlagsBits} = require('discord.js'); //imports discord.js
const OpenAI = require("openai");
const fs = require("fs");

LOG_FILE = "storage.txt";

const openai = new OpenAI();
const discord = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
]});

const activeThreads = new Map();
const activeChannels = new Map();

const ASSISTANT = process.env.UNFAIR_ID;

discord.on('ready', () => {
  console.log(`Logged in as ${discord.user.tag}!`);
});

discord.on('messageCreate', async msg => {
  mquery = msg.content.substring(0, msg.content.indexOf(" ") !== -1 ? msg.content.indexOf(" ") : msg.content.length);
  mcontent = msg.content.indexOf(" ") !== -1 ? msg.content.substring(msg.content.indexOf(" ")).trim() : "";

  if (mquery.startsWith(`${process.env.CALL_SIGN}`)) {
    const user = discord.users.cache.get(msg.author.id);

    mquery = mquery.substring(1);
    // Now we filter the type of message
    if (mquery === "ping") {
      msg.reply('Pong!');
    }

    if (mquery === "start") {
      // Build the AI helper
      const userThread = await openai.beta.threads.create()
      const message = await openai.beta.threads.messages.create(userThread.id,
        {
          role : "user",
          content : "Let's begin the adventure!"
        }
      );
      msg.delete();

      // Start the challenge
      // Create the valid channel
      channel = msg.guild.channels.create({
        name: user.globalName,
        type: ChannelType.GuildText,
        parent: msg.channel.parent,
        permissionOverwrites: [
          {
            id: msg.guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: msg.author.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: discord.user.id,
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      }).then(channel => {
        // Afterwards, get the Discord run used
        channel.send("Welcome! Please wait as we generate your adventure...");
        getRun(userThread.id, channel);

        // Store the user's thread ID
        activeThreads.set(user.id , userThread.id);
        activeChannels.set(channel.id, user.id);
        // console.log("Stored " + channel.id + " " + user.id);

        fs.writeFile(LOG_FILE, `${user.id} ${userThread.id} ${channel.id}`, (err) => {if (err){ throw err }});
      });

    }
  } else if (activeChannels.has(msg.channel.id) && activeThreads.has(msg.author.id)) {
    // Very "hacky" solution but fuck it we ball I guess
    // Check if the message was sent in an active channel
    // console.log(msg.channel.id + " " + msg.author.id);
    // console.log("active channel detected. Generating a response");
    channel = msg.channel;
    // userIds should? be unique
    userId = activeChannels.get(channel.id);
    // Get the thead id
    threadId = activeThreads.get(userId);

    const message = await openai.beta.threads.messages.create(threadId,
      {
        role : "user",
        content : msg.content
      }
    );

    getRun(threadId, channel);
  }

  // console.log(msg.channel.id + " " + msg.author.id)
});

async function getRun(thread_id, channel) {
  // Can't have it reply by username because it breaks the whole AI for no fucking reason
  let reply = "";
  const run = openai.beta.threads.runs.stream(thread_id, {
    assistant_id: ASSISTANT,
  })
  .on('textDelta', (textDelta, snapshot) => {reply += textDelta.value}).on('end', () => channel.send(reply));
}

//this line must be at the very end
discord.login(process.env.CLIENT_TOKEN); //signs the bot in with token