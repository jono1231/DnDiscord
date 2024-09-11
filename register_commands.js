require('dotenv').config(); //initializes dotenv
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName("ping").setDescription("Replies with pong"),
    new SlashCommandBuilder()
        .setName("start").setDescription("Starts the challenge"),
    new SlashCommandBuilder()
        .setName("reset").setDescription("Resets the discord challenge"),
    new SlashCommandBuilder()
        .setName("solve").setDescription("Attempt to solve the challenge")
        .addStringOption(option => option.setName("flag").setDescription("The password of the challenge"))
];

const rest = new REST().setToken(process.env.CLIENT_TOKEN);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
            Routes.applicationCommands(process.env.APP_ID),
            { body: commands },
        );

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();