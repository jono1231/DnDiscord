require('dotenv').config()

const OpenAI = require("openai");

const openai = new OpenAI();

async function main() {
    // const stream = await openai.chat.completions.create({
    //     model: "gpt-4",
    //     messages: [{ role: "user", content: "Say this is a test" }],
    //     stream: true,
    // });
    // for await (const chunk of stream) {
    //     process.stdout.write(chunk.choices[0]?.delta?.content || "");
    // }
    const userThread = await openai.beta.threads.create()
    const message = await openai.beta.threads.messages.create(userThread.id,
        {
            role : "user",
            content : ""
        }
    );
    
    // We use the stream SDK helper to create a run with
    // streaming. The SDK provides helpful event listeners to handle 
    // the streamed response.
    const run = openai.beta.threads.runs.stream(userThread.id, {
        assistant_id: process.env.TEST_ID
    })
    .on('textCreated', (text) => process.stdout.write('\nassistant > '))
    .on('textDelta', (textDelta, snapshot) => process.stdout.write(textDelta.value))
    .on('toolCallCreated', (toolCall) => process.stdout.write(`\nassistant > ${toolCall.type}\n\n`))
    .on('toolCallDelta', (toolCallDelta, snapshot) => {
      if (toolCallDelta.type === 'code_interpreter') {
        if (toolCallDelta.code_interpreter.input) {
          process.stdout.write(toolCallDelta.code_interpreter.input);
        }
        if (toolCallDelta.code_interpreter.outputs) {
          process.stdout.write("\noutput >\n");
          toolCallDelta.code_interpreter.outputs.forEach(output => {
            if (output.type === "logs") {
              process.stdout.write(`\n${output.logs}\n`);
            }
          });
        }
      }
    });
}

main();