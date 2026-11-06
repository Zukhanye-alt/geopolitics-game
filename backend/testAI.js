import "dotenv/config";

import { generateAICommentary } from "./services/aiService.js";

async function testAI() {

    try {

        console.log("Testing Hugging Face connection...");

        const commentary = await generateAICommentary({
            attacker: "South Africa",
            defender: "Egypt",
            attackerSoldiers: 6,
            defenderSoldiers: 4,
            attackerDice: [5, 4],
            defenderDice: [2, 6],
            attackerLosses: 1,
            defenderLosses: 1,
            outcome: "Both countries lost one soldier."
        });

        console.log("\nAI GENERATED COMMENTARY:\n");

        console.log(commentary);

    } catch (error) {

        console.error("AI TEST FAILED:");
        console.error(error.message);

    }
}

testAI(); 