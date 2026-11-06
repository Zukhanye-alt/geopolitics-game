import { generateAICommentary } from "./aiService.js";

import {
    getPendingBattleCommentary,
    removePendingBattleCommentary
} from "./battleCommentaryQueue.js";


// Generate AI commentary for all queued battles belonging to a game.
export async function processBattleCommentary(game) {

    if (!game) {
        throw new Error("Game not found.");
    }
    
    const pendingBattles = getPendingBattleCommentary(game.id);

    if (pendingBattles.length === 0) {
        return game;
    }

    for (const battle of pendingBattles) {

        // Send the actual battle information to the AI.
        const message = await generateAICommentary(battle);

        if (!message) {
            throw new Error("The AI returned empty commentary.");
        }

        // Add the AI-generated commentary to the game.
        game.commentary.push({
            type: "battle",
            source: "llm",
            round: battle.round,
            message,
            timestamp: new Date()
        });

        // Remove this battle only after successful generation.
        removePendingBattleCommentary(
            game.id,
            battle.queuedAt
        );

    }

    return game;

} 