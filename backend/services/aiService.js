import { InferenceClient } from "@huggingface/inference";

const MODEL = "openai/gpt-oss-120b:cheapest";

export async function generateAICommentary(battleContext) {
    if (!process.env.HF_TOKEN) {
        throw new Error("Hugging Face API token is missing.");
    }

    const client = new InferenceClient(process.env.HF_TOKEN);

    const response = await client.chatCompletion({
        model: MODEL,
        messages: [
            {
                role: "system",
                content: `
                    You are the battle commentator for a geopolitics
                    strategy game.

                    Generate engaging, concise commentary based
                    ONLY on the battle information provided.

                    Describe the battle naturally, like a strategy
                    game commentator.

                    Do not invent dice results, casualties,
                    countries, or battle outcomes.

                    Do not make decisions for the game.

                    Keep your response between 2 and 4 sentences.
                `
            },
            {
                role: "user",
                content: `
                    Describe the following battle event:

                    ${JSON.stringify(battleContext)}
                `
            }
        ],
        max_tokens: 120,
        temperature: 0.7
    });

    const commentary = response.choices?.[0]?.message?.content;

    if (!commentary) {
        throw new Error("The AI returned empty commentary.");
    }

    return commentary.trim();
} 