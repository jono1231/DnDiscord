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
  const user = discord.users.cache.get(msg.author.id);
  mquery = msg.content.substring(0, msg.content.indexOf(" ") !== -1 ? msg.content.indexOf(" ") : msg.content.length);
  mcontent = msg.content.indexOf(" ") !== -1 ? msg.content.substring(msg.content.indexOf(" ")).trim() : "";

  if (mquery.startsWith(`${process.env.CALL_SIGN}`)) {
    mquery = mquery.substring(1);

    console.log(mquery + " " + mcontent);

    if (mquery === "solve" && mcontent === process.env.FLAG) {
      // TODO: Give solved role when I can figure that out
      // console.log(mcontent);
      msg.reply("Congrats!");
    }

    if (mquery === "start") {
      if (activeChannels.has(user.id)) {
        // TODO: Implement some error checking
      } else {
        await start(msg, user);
      }
    }

    if (mquery === "reset") {
      await reset(user);
    }

    msg.delete();

  } else if (activeChannels.has(user.id) &&
              activeChannels.get(user.id) === msg.channel.id && activeThreads.has(user.id)) {

    // Very "hacky" solution but fuck it we ball I guess
    // Check if the message was sent in an active channel
    // console.log(msg.channel.id + " " + msg.author.id);
    console.log("active channel detected. Generating a response");
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

  // console.log(msg.channel.id + " " + msg.author.id)
});

// // TODO: Give role on join when I can
// discord.on('guildMemberAdd', async member => {
//   console.log('User ' + member.user.username + 'has joined the server!') 
//   let role = member.guild.roles.cache.find(x => x.name == 'Adventurers'); 
//   member.roles.add(role)
// });

async function start(msg, user) {
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
    channel.setRateLimitPerUser(5, "Don't fuck up");
    // console.log("Channel created");
    // Afterwards, get the Discord run used
    channel.send("Welcome! Please wait as we generate your adventure...");
    getRun(userThread.id, channel.id);

    // Store the user's thread ID
    activeThreads.set(user.id , userThread.id);
    activeChannels.set(user.id, channel.id);
    // console.log("Stored " + channel.id + " " + user.id);
  });
}

async function reset(user) {
  id = user.id;
  if (activeThreads.has(user.id)) {
    channel = await discord.channels.fetch(activeChannels.get(user.id));
    
    channel.send("Resetting the adventure... Please wait");

    const userThread = await openai.beta.threads.create()
    const message = await openai.beta.threads.messages.create(userThread.id,
      {
        role : "user",
        content : "Let's begin the adventure!"
      }
    );

    getRun(userThread.id, channel.id);

    activeThreads.set(user.id , userThread.id);
  }
}

async function getRun(thread_id, cId) {
  const channel = await discord.channels.fetch(cId)
  // console.log(channel);
  // Can't have it reply by username because it breaks the whole AI for no fucking reason
  // TODO: 2000 CHARACTER LIMIT CHECK
  let reply = "";
  const run = openai.beta.threads.runs.stream(thread_id, {
    assistant_id: ASSISTANT,
  })
  .on('textDelta', (textDelta, snapshot) => {reply += textDelta.value}).on('end', () => channel.send(reply));

}

//this line must be at the very end
discord.login(process.env.CLIENT_TOKEN); //signs the bot in with token