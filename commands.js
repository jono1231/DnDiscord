export {start, solve, reset}

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
    });
}

async function solve() {
    
}
  
async function reset(user) {
    // TODO: LOG THE RESET CHANGE
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
          channel.send("Reply was 0 characters long. This should never happen, but is a problem with OpenAI API. Please send your message again.");
        }
      }
    );
  
}