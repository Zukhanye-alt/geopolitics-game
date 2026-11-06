import { randomUUID } from "crypto";
import Game from "../models/Game.js";
import {
    getOwnedCountries,
    getEnemyCountries,
    chooseAttackingCountry,
    chooseTargetCountry,
    shouldNpcAttack,
    chooseReinforcementCountry
} from "./npcService.js";

import {
    generateBattleCommentary,
    generateConquestCommentary,
    generateNpcDecisionCommentary
} from "./commentaryService.js";

// Temporary in-memory cache for active games.
const games = [];

// Load a game from MongoDB into the in-memory cache.
export async function loadGameFromDatabase(gameId) {

    // Check whether MongoDB is connected.
    if (Game.db.readyState !== 1) {

        console.log(
            "MongoDB unavailable. Using in-memory game data."
        );

        return getGameById(gameId) || null;
    }

    try {

        const savedGame = await Game.findOne({ id: gameId });

        if (!savedGame) {
            return getGameById(gameId) || null;
        }

        const gameData = savedGame.toObject();

        const existingIndex = games.findIndex(
            game => game.id === gameId
        );

        if (existingIndex !== -1) {
            games[existingIndex] = gameData;
        } else {
            games.push(gameData);
        }

        return gameData;

    } catch (error) {

        console.error(
            "Could not load game from MongoDB:",
            error.message
        );

        return getGameById(gameId) || null;

    }
}

// Retrieve a summary of all available games.
export async function getAvailableGames() {

    // If MongoDB is connected, retrieve games from the database.
    if (Game.db.readyState === 1) {

        try {
            const databaseGames = await Game.find({})
                .select("id status round players countries currentPlayerId createdAt")
                .sort({ createdAt: -1 })
                .lean();

            return databaseGames.map(game => {

                const currentPlayer = game.players.find(
                    player => player.id === game.currentPlayerId
                );

                return {
                    id: game.id,
                    status: game.status,
                    round: game.round,
                    playerCount: game.players.length,
                    countryCount: game.countries.length,
                    currentPlayerName: currentPlayer?.name || "Unknown",
                    createdAt: game.createdAt
                };
            });

        } catch (error) {
            console.error(
                "Could not retrieve games from MongoDB:",
                error.message
            );
        }
    }

    // If MongoDB is unavailable, use the in-memory games.
    return games.map(game => {

        const currentPlayer = game.players.find(
            player => player.id === game.currentPlayerId
        );

        return {
            id: game.id,
            status: game.status,
            round: game.round,
            playerCount: game.players.length,
            countryCount: game.countries.length,
            currentPlayerName: currentPlayer?.name || "Unknown",
            createdAt: game.createdAt || null
        };
    });
} 

// Save a game to MongoDB.
export async function saveGameToDatabase(game) {

    if (!game) {
        throw new Error("Cannot save an empty game.");
    }

    // If MongoDB is unavailable, retain the game in memory.
    if (Game.db.readyState !== 1) {

        console.warn(
            `Game ${game.id} is currently stored in memory only.`
        );

        return null;
    }

    const {
        _id,
        __v,
        createdAt,
        updatedAt,
        ...gameData
    } = game;

    try {

        const savedGame = await Game.findOneAndUpdate(
            { id: game.id },
            { $set: gameData },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        console.log(`Game ${game.id} saved to MongoDB.`);

        return savedGame;

    } catch (error) {

        console.error(
            "Could not save game to MongoDB:",
            error.message
        );

        throw error;

    }
}

// NPC names
const npcNames = [
    "NPC 1",
    "NPC 2",
    "NPC 3",
    "NPC 4",
    "NPC 5",
    "NPC 6",
    "NPC 7",
    "NPC 8",
    "NPC 9"
];

// Create a new game.
export function createGame(
    selectedCountries,
    startingCountryName,
    ownerUserId
) {

    if (!ownerUserId) {
        throw new Error("An authenticated user is required to create a game.");
    }

    if (!Array.isArray(selectedCountries) || selectedCountries.length !== 10) {
        throw new Error("A game must have exactly 10 countries.");
    }

    const startingCountry = selectedCountries.find(
        country => country.name === startingCountryName
    );

    if (!startingCountry) {
        throw new Error("Starting country was not found.");
    }

    // Create the human player.
    const players = [
        {
            id: "human-player",
            name: "Player",
            type: "human",
            eliminated: false
        }
    ];

    // Create nine NPC opponents.
    npcNames.forEach((name, index) => {
        players.push({
            id: `npc-${index + 1}`,
            name,
            type: "npc",
            eliminated: false
        });
    });

    // Give each country an owner and soldier count.
    const gameCountries = selectedCountries.map(country => {
        const isStartingCountry = country.name === startingCountryName;

        return {
            name: country.name,
            population: country.population,

            // Original soldier value never changes.
            originalSoldiers: country.soldiers,

            // Current soldier count changes during gameplay.
            soldiers: country.soldiers,

            ownerId: isStartingCountry
                ? "human-player"
                : `npc-${selectedCountries
                    .filter(c => c.name !== startingCountryName)
                    .findIndex(c => c.name === country.name) + 1}`
        };
    });

    // Randomise the turn order.
    const turnOrder = [...players]
        .sort(() => Math.random() - 0.5)
        .map(player => player.id);

    const game = {
        id: randomUUID(),
        ownerUserId: ownerUserId.toString(), 
        round: 1,
        status: "active",
        players,
        countries: gameCountries,
        turnOrder,
        currentTurnIndex: 0,
        currentPlayerId: turnOrder[0],
        events: [],
        commentary: [],
        pendingReinforcements: null
    };

    games.push(game);

    // If an NPC starts, automatically play NPC turns
    // until it becomes the human player's turn.
    advanceNpcTurnsUntilHuman(game.id);

    return game;
}

// Find a game using its ID.
export function getGameById(gameId) {
    return games.find(game => game.id === gameId);
}

export function skipTurn(gameId) {

    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    if (game.status !== "active") {
        throw new Error("This game is not active.");
    }

    if (game.currentPlayerId !== "human-player") {
        throw new Error("It is not your turn.");
    }

    if (game.pendingConquest) {
        throw new Error("Allocate your conquest reward before ending your turn.");
    }

    if (game.pendingReinforcements) {
        throw new Error("Allocate your reinforcements before ending your turn.");
    }

    // Advance through players until it is the human player's turn again.
    let safetyCounter = 0;

    while (safetyCounter < game.turnOrder.length) {

        safetyCounter++;

        game.currentTurnIndex++;

        // Check whether the round has ended.
        if (game.currentTurnIndex >= game.turnOrder.length) {
            game.currentTurnIndex = 0;
            game.round++;
        }

        game.currentPlayerId = game.turnOrder[game.currentTurnIndex];

        const currentPlayer = game.players.find(
            player => player.id === game.currentPlayerId
        );

        if (!currentPlayer) {
            continue;
        }

        // Check whether this player still owns any countries.
        const ownedCountries = game.countries.filter(
            country => country.ownerId === currentPlayer.id
        );

        if (ownedCountries.length === 0) {
            currentPlayer.eliminated = true;
            continue;
        }

        // If it is the human player's turn, stop advancing.
        if (currentPlayer.type === "human") {

            game.events.push({
                message: "It is now your turn."
            });

            // Give the human player reinforcements from Round 2.
            if (game.round >= 2) {

                const reinforcementAmount = ownedCountries.length * 2;

                game.pendingReinforcements = {
                    playerId: currentPlayer.id,
                    amount: reinforcementAmount
                };

                game.events.push({
                    message: `You have received ${reinforcementAmount} reinforcement soldiers to allocate.`
                });

            }

            return game;
        }

        // Automatically execute the NPC's turn.
        game.events.push({
            message: `${currentPlayer.name} is taking their turn.`
        });

        playNpcTurn(gameId);

        // Stop if the game has ended.
        if (game.status !== "active") {
            return game;
        }

    }

    return game;
}

export function transferSoldiers(
    gameId,
    fromCountryName,
    toCountryName,
    amount
) {
    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    if (game.status !== "active") {
        throw new Error("This game is not active.");
    }

    if (game.pendingConquest || game.pendingReinforcements) {
        throw new Error("Complete your pending allocations first.");
    }

    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("Transfer amount must be a positive whole number.");
    }

    const fromCountry = game.countries.find(
        country => country.name === fromCountryName
    );

    const toCountry = game.countries.find(
        country => country.name === toCountryName
    );

    if (!fromCountry || !toCountry) {
        throw new Error("One or both countries could not be found.");
    }

    if (fromCountry.ownerId !== toCountry.ownerId) {
        throw new Error("You can only transfer soldiers between countries owned by the same player.");
    }

    if (fromCountryName === toCountryName) {
        throw new Error("Choose two different countries.");
    }

    if (fromCountry.soldiers - amount < 1) {
        throw new Error("A country must retain at least one soldier.");
    }

    fromCountry.soldiers -= amount;
    toCountry.soldiers += amount;

    game.events.push({
        message: `${amount} soldiers were transferred from ${fromCountry.name} to ${toCountry.name}.`
    });

    return game;
}
// Generate a random dice roll between 1 and 6.
function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
}

// Resolve one round of an attack.
export function resolveAttack(
    gameId,
    attackerCountryName,
    defenderCountryName
) {
    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    if (game.status !== "active") {
        throw new Error("This game is not active.");
    }

    // Make sure it is the human player's turn.
    if (game.currentPlayerId !== "human-player") {
        throw new Error("It is not your turn.");
    }

    // Find the attacking and defending countries.
    const attackerCountry = game.countries.find(
        country => country.name === attackerCountryName
    );

    const defenderCountry = game.countries.find(
        country => country.name === defenderCountryName
    );

    if (!attackerCountry || !defenderCountry) {
        throw new Error("One or both countries could not be found.");
    }

    // Make sure the attacker owns the attacking country.
    if (attackerCountry.ownerId !== "human-player") {
        throw new Error("You do not own the attacking country.");
    }

    // Make sure the defender owns the defending country.
    if (defenderCountry.ownerId === "human-player") {
        throw new Error("You cannot attack your own country.");
    }

    // Make sure the player selects two different countries.
    if (attackerCountry.name === defenderCountry.name) {
        throw new Error("You cannot attack the same country.");
    }

    // The attacker needs at least two soldiers.
    if (attackerCountry.soldiers < 2) {
        throw new Error("You need at least two soldiers to attack.");
    }

    // The defender must still have soldiers.
    if (defenderCountry.soldiers < 1) {
        throw new Error("This country has already been defeated.");
    }

    // Calculate the number of dice.
    const diceCount = Math.min(
        attackerCountry.soldiers - 1,
        defenderCountry.soldiers
    );

    // Generate dice rolls.
    const attackerDice = Array.from(
        { length: diceCount },
        () => rollDie()
    );

    const defenderDice = Array.from(
        { length: diceCount },
        () => rollDie()
    );

    // Sort both sets of dice from highest to lowest.
    attackerDice.sort((a, b) => b - a);
    defenderDice.sort((a, b) => b - a);

    let attackerLosses = 0;
    let defenderLosses = 0;

    const comparisons = [];

    // Compare dice in pairs.
    for (let i = 0; i < diceCount; i++) {

        if (attackerDice[i] > defenderDice[i]) {

            defenderLosses++;

            comparisons.push({
                attackerRoll: attackerDice[i],
                defenderRoll: defenderDice[i],
                winner: "attacker"
            });

        } else if (defenderDice[i] > attackerDice[i]) {

            attackerLosses++;

            comparisons.push({
                attackerRoll: attackerDice[i],
                defenderRoll: defenderDice[i],
                winner: "defender"
            });

        } else {

            comparisons.push({
                attackerRoll: attackerDice[i],
                defenderRoll: defenderDice[i],
                winner: "tie"
            });
        }
    }

    // Apply casualties.
    attackerCountry.soldiers -= attackerLosses;
    defenderCountry.soldiers -= defenderLosses;

    // Check whether the defender has been defeated.
    const conquered = defenderCountry.soldiers === 0;
    // Handle country conquest.
    if (conquered) {

        // Transfer ownership to the human player.
        defenderCountry.ownerId = "human-player";

        // Calculate conquest reward.
        const rewardSoldiers = Math.max(
            2,
            Math.floor(defenderCountry.originalSoldiers / 2)
        );

        // Store the pending conquest for reward allocation.
        // Record the round in which the country was conquered.
        defenderCountry.lastConqueredRound = game.round;

        game.pendingConquest = {
            countryName: defenderCountry.name,
            attackerCountryName: attackerCountry.name,
            rewardSoldiers
        };

    }

    // Store the latest battle results.
    game.lastBattle = {
        attackerCountry: attackerCountry.name,
        defenderCountry: defenderCountry.name,
        attackerDice,
        defenderDice,
        comparisons,
        attackerLosses,
        defenderLosses,
        diceCount,
        conquered
    };

    const commentary = generateBattleCommentary(
        game.lastBattle
    );

    game.commentary.push({
        type: "battle",
        round: game.round,
        message: commentary,
        timestamp: new Date()
    });

    // Add the battle to the event history.
    game.events.push({
        message: `${attackerCountry.name} attacked ${defenderCountry.name}. ` +
            `Attacker lost ${attackerLosses} soldiers. ` +
            `Defender lost ${defenderLosses} soldiers.`
    });

    if (conquered) {
        game.events.push({
            message: `${defenderCountry.name} has been conquered by the human player!`
        });

        game.events.push({
            message: `Conquest reward: ${game.pendingConquest.rewardSoldiers} soldiers.`
        });
    }

    return game;
}

// Allocate conquest reward soldiers.
export function allocateConquestReward(gameId, transferAmount) {

    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    if (game.status !== "active") {
        throw new Error("This game is not active.");
    }

    if (!game.pendingConquest) {
        throw new Error("There is no pending conquest reward.");
    }

    if (
        !Number.isInteger(transferAmount) ||
        transferAmount < 0
    ) {
        throw new Error("Transfer amount must be a non-negative whole number.");
    }

    const conquest = game.pendingConquest;

    if (transferAmount > conquest.rewardSoldiers) {
        throw new Error("You cannot transfer more soldiers than your reward.");
    }

    const attackerCountry = game.countries.find(
        country => country.name === conquest.attackerCountryName
    );

    const conqueredCountry = game.countries.find(
        country => country.name === conquest.countryName
    );

    if (!attackerCountry || !conqueredCountry) {
        throw new Error("Could not find the countries involved.");
    }

    if (attackerCountry.soldiers < 1) {
        throw new Error("The attacking country must retain at least one soldier.");
    }

    // Add the reward soldiers to the attacking country.
    attackerCountry.soldiers += conquest.rewardSoldiers;

    // Transfer the selected reward soldiers.
    attackerCountry.soldiers -= transferAmount;
    conqueredCountry.soldiers += transferAmount;

    // Generate human conquest commentary.
    const commentary = generateConquestCommentary(
        attackerCountry.name,
        conqueredCountry.name,
        conquest.rewardSoldiers
    );

    game.commentary.push({
        type: "conquest",
        round: game.round,
        message: commentary,
        timestamp: new Date()
    });

    // Record the allocation.
    game.events.push({
        message: `${conquest.rewardSoldiers} conquest reward soldiers awarded.`
    });

    game.events.push({
        message: `${transferAmount} soldiers transferred to ${conqueredCountry.name}.`
    });

    // Clear the pending conquest.
    game.pendingConquest = null;

    checkGameStatus(game);

    return game;
}

// Allocate reinforcement soldiers.
export function allocateReinforcements(gameId, allocations) {

    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    if (game.status !== "active") {
        throw new Error("This game is not active.");
    }

    if (!game.pendingReinforcements) {
        throw new Error("There are no reinforcements waiting to be allocated.");
    }

    if (game.currentPlayerId !== "human-player") {
        throw new Error("It is not your turn.");
    }

    if (!allocations || typeof allocations !== "object" || Array.isArray(allocations)) {
        throw new Error("Invalid reinforcement allocation.");
    }

    const expectedAmount = game.pendingReinforcements.amount;

    let totalAllocated = 0;

    // Validate each allocation.
    for (const [countryName, amount] of Object.entries(allocations)) {

        if (!Number.isInteger(amount) || amount < 0) {
            throw new Error("Soldier allocations must be non-negative whole numbers.");
        }

        const country = game.countries.find(
            c => c.name === countryName
        );

        if (!country || country.ownerId !== "human-player") {
            throw new Error(`You do not own ${countryName}.`);
        }

        totalAllocated += amount;

    }

    // Ensure all reinforcement soldiers are allocated.
    if (totalAllocated !== expectedAmount) {
        throw new Error(
            `You must allocate exactly ${expectedAmount} soldiers.`
        );
    }

    // Apply the allocations.
    for (const [countryName, amount] of Object.entries(allocations)) {

        const country = game.countries.find(
            c => c.name === countryName
        );

        country.soldiers += amount;

    }

    game.events.push({
        message: `The human player allocated ${expectedAmount} reinforcement soldiers.`
    });

    // Clear the pending reinforcement allocation.
    game.pendingReinforcements = null;

    return game;

}

// Roll a six-sided die.
function rollNpcDie() {
    return Math.floor(Math.random() * 6) + 1;
}

// Resolve one round of an NPC attack.
function resolveNpcAttackRound(game, attacker, defender) {

    const diceCount = Math.min(
        attacker.soldiers - 1,
        defender.soldiers
    );

    const attackerDice = Array.from(
        { length: diceCount },
        () => rollNpcDie()
    );

    const defenderDice = Array.from(
        { length: diceCount },
        () => rollNpcDie()
    );

    attackerDice.sort((a, b) => b - a);
    defenderDice.sort((a, b) => b - a);

    let attackerLosses = 0;
    let defenderLosses = 0;

    const comparisons = [];

    for (let i = 0; i < diceCount; i++) {

        if (attackerDice[i] > defenderDice[i]) {

            defenderLosses++;

            comparisons.push({
                attackerRoll: attackerDice[i],
                defenderRoll: defenderDice[i],
                winner: "attacker"
            });

        } else if (defenderDice[i] > attackerDice[i]) {

            attackerLosses++;

            comparisons.push({
                attackerRoll: attackerDice[i],
                defenderRoll: defenderDice[i],
                winner: "defender"
            });

        } else {

            comparisons.push({
                attackerRoll: attackerDice[i],
                defenderRoll: defenderDice[i],
                winner: "tie"
            });

        }

    }

    attacker.soldiers -= attackerLosses;
    defender.soldiers -= defenderLosses;
    const conquered = defender.soldiers === 0;

    game.events.push({
        message:
            `${attacker.name} attacked ${defender.name}. ` +
            `Attacker dice: ${attackerDice.join(", ")}. ` +
            `Defender dice: ${defenderDice.join(", ")}.`
    });

    game.events.push({
        message:
            `${attacker.name} lost ${attackerLosses} soldiers. ` +
            `${defender.name} lost ${defenderLosses} soldiers.`
    });

    const commentary = generateBattleCommentary({
        attackerCountry: attacker.name,
        defenderCountry: defender.name,
        attackerLosses,
        defenderLosses,
        conquered
    });

    game.commentary.push({
        type: "npc-battle",
        round: game.round,
        message: commentary,
        timestamp: new Date()
    });

    return {
        conquered,
        attackerLosses,
        defenderLosses,
        attackerDice,
        defenderDice,
        comparisons
    };


}

// Handle NPC country conquest.
function handleNpcConquest(game, npc, attacker, defender) {

    defender.ownerId = npc.id;

    defender.lastConqueredRound = game.round;

    const rewardSoldiers = Math.max(
        2,
        Math.floor(defender.originalSoldiers / 2)
    );

    const commentary = generateConquestCommentary(
        npc.name,
        defender.name,
        rewardSoldiers
    );

    game.commentary.push({
        type: "conquest",
        round: game.round,
        message: commentary,
        timestamp: new Date()
    });

    // Add the reward to the attacking country.
    attacker.soldiers += rewardSoldiers;

    // NPCs decide how many reward soldiers to transfer.
    // Our initial strategy sends half, rounded down.
    const transferAmount = Math.floor(rewardSoldiers / 2);

    attacker.soldiers -= transferAmount;
    defender.soldiers += transferAmount;

    game.events.push({
        message:
            `${npc.name} conquered ${defender.name}!`
    });

    game.events.push({
        message:
            `${npc.name} received ${rewardSoldiers} reward soldiers.`
    });

    game.events.push({
        message:
            `${npc.name} transferred ${transferAmount} soldiers ` +
            `to ${defender.name}.`
    });

    checkGameStatus(game);

}

// Execute an NPC attack.
function executeNpcAttack(game, npc) {

    const attacker = chooseAttackingCountry(game, npc.id);

    const defender = chooseTargetCountry(game, npc.id);

    if (!attacker || !defender) {

        const reason = "No suitable attacking country or enemy target was available.";

        game.events.push({
            message: `${npc.name} decided not to attack because no suitable attack was available.`
        });

        game.commentary.push({
            type: "npc-decision",
            round: game.round,
            message: generateNpcDecisionCommentary(
                npc.name,
                "decided not to attack",
                reason
            ),
            timestamp: new Date()
        });

        return;

    }

    if (!shouldNpcAttack(attacker, defender)) {

        const reason =
            `${defender.name} has ${defender.soldiers} soldiers, ` +
            `while ${attacker.name} only has ${attacker.soldiers}.`;

        game.events.push({
            message:
                `${npc.name} decided not to attack ${defender.name}. ` +
                `The defence is too strong compared with its attacking force.`
        });

        game.commentary.push({
            type: "npc-decision",
            round: game.round,
            message: generateNpcDecisionCommentary(
                npc.name,
                `decided not to attack ${defender.name}`,
                reason
            ),
            timestamp: new Date()
        });

        return;

    }

    game.events.push({
        message:
            `${npc.name} selected ${attacker.name} to attack ` +
            `${defender.name}.`
    });

    game.events.push({
        message:
            `${npc.name} evaluated ${defender.name} as a potential target.`
    });

    game.events.push({
        message:
            `${defender.name} has ${defender.soldiers} defending soldiers, ` +
            `while ${attacker.name} has ${attacker.soldiers} attacking soldiers.`
    });

    game.events.push({
        message:
            `${npc.name} decided that the attack was worthwhile because ` +
            `its attacking force has a numerical advantage.`
    });

    game.commentary.push({
        type: "npc-decision",
        round: game.round,
        message: generateNpcDecisionCommentary(
            npc.name,
            `selected ${attacker.name} to attack ${defender.name}`,
            `${attacker.name} has ${attacker.soldiers} soldiers compared ` +
            `with ${defender.name}'s ${defender.soldiers} soldiers, ` +
            `giving the attacking force an advantage of ` +
            `${attacker.soldiers - defender.soldiers} soldiers.`
        ),
        timestamp: new Date()
    });

    let attackRounds = 0;

    const maximumAttackRounds = 20;

    while (
        attacker.soldiers >= 2 &&
        defender.soldiers > 0 &&
        attackRounds < maximumAttackRounds
    ) {

        const result = resolveNpcAttackRound(
            game,
            attacker,
            defender
        );

        attackRounds++;

        if (result.conquered) {

            handleNpcConquest(
                game,
                npc,
                attacker,
                defender
            );

            return;

        }

        if (attacker.soldiers <= 1) {

            game.events.push({
                message:
                    `${npc.name} stopped attacking because ` +
                    `${attacker.name} has only one soldier remaining.`
            });

            game.commentary.push({
                type: "npc-decision",
                round: game.round,
                message: generateNpcDecisionCommentary(
                    npc.name,
                    "stopped attacking",
                    `${attacker.name} has only one soldier remaining and must retain it to defend the country.`
                ),
                timestamp: new Date()
            });

            return;

        }

        // Stop if the attacking country has become weaker.
        if (attacker.soldiers < defender.soldiers) {

            game.events.push({
                message:
                    `${npc.name} decided to stop attacking ` +
                    `because the remaining defence is too strong.`
            });

            game.commentary.push({
                type: "npc-decision",
                round: game.round,
                message: generateNpcDecisionCommentary(
                    npc.name,
                    "decided to stop attacking",
                    `${defender.name} now has more soldiers than ${attacker.name}, making further attacks less favourable.`
                ),
                timestamp: new Date()
            });

            return;

        }

    }

    if (attackRounds >= maximumAttackRounds) {

        game.events.push({
            message:
                `${npc.name} ended its attack after reaching the ` +
                `maximum number of battle rounds.`
        });

        game.commentary.push({
            type: "npc-decision",
            round: game.round,
            message: generateNpcDecisionCommentary(
                npc.name,
                "ended its attack",
                `The battle reached the maximum number of rounds without a clear winner.`
            ),
            timestamp: new Date()
        });

    }

}

// Allow NPCs to transfer soldiers between their countries.
function executeNpcTransfer(game, npc) {

    const ownedCountries = getOwnedCountries(game, npc.id);

    if (ownedCountries.length < 2) {
        return;
    }

    const sortedCountries = [...ownedCountries].sort(
        (a, b) => a.soldiers - b.soldiers
    );

    const weakestCountry = sortedCountries[0];

    const strongestCountry = sortedCountries[sortedCountries.length - 1];

    // Do not transfer soldiers if both selections are the same country.
    if (strongestCountry.name === weakestCountry.name) {
        return;
    }

    // Keep at least one soldier in the strongest country.
    if (strongestCountry.soldiers <= 2) {
        return;
    }

    // Only transfer soldiers when there is a significant imbalance.
    if (weakestCountry.soldiers >= strongestCountry.soldiers * 0.6) {
        game.events.push({
            message:
                `${npc.name} decided not to transfer soldiers because ` +
                `its territories are reasonably balanced.`
        });

        return;
    }

    // Transfer approximately one-third of the difference.
    const difference = strongestCountry.soldiers - weakestCountry.soldiers;

    const transferAmount = Math.min(
        Math.floor(difference / 3),
        strongestCountry.soldiers - 1
    );

    if (transferAmount <= 0) {
        return;
    }

    strongestCountry.soldiers -= transferAmount;

    weakestCountry.soldiers += transferAmount;

    game.events.push({
        message:
            `${npc.name} transferred ${transferAmount} soldiers ` +
            `from ${strongestCountry.name} to ${weakestCountry.name}.`
    });

    game.events.push({
        message:
            `${npc.name} strengthened its weakest territory because ` +
            `it had significantly fewer soldiers than its strongest territory.`
    });
}

// Simulate one complete NPC turn.
export function playNpcTurn(gameId) {

    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    if (game.status !== "active") {
        throw new Error("This game is not active.");
    }

    if (game.pendingConquest || game.pendingReinforcements) {
        throw new Error("Complete pending allocations before continuing.");
    }

    const npc = game.players.find(
        player => player.id === game.currentPlayerId
    );

    if (!npc || npc.type !== "npc") {
        throw new Error("The current player is not an NPC.");
    }

    const ownedCountries = getOwnedCountries(game, npc.id);

    if (ownedCountries.length === 0) {

        if (!npc.eliminated) {

            npc.eliminated = true;

            game.events.push({
                message: `${npc.name} has been eliminated.`
            });

        }

        checkGameStatus(game);

        return game;

    }

    game.events.push({
        message: `${npc.name} is evaluating the board.`
    });

    // Reinforcements from Round 2 onwards.
    if (game.round >= 2) {

        const reinforcementAmount = ownedCountries.length * 2;

        const reinforcementCountry = chooseReinforcementCountry(
            game,
            npc.id
        );

        if (reinforcementCountry) {

            reinforcementCountry.soldiers += reinforcementAmount;

            game.events.push({
                message:
                    `${npc.name} received ${reinforcementAmount} ` +
                    `reinforcement soldiers and allocated them to ` +
                    `${reinforcementCountry.name}.`
            });

        }

    }

    // Decide whether to transfer soldiers.
    executeNpcTransfer(game, npc);

    // Decide whether to attack.
    executeNpcAttack(game, npc);

    return game;

}

// Fast-forward through NPC turns until the human player's turn.
export function fastForwardToHuman(gameId) {

    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    if (game.status !== "active") {
        throw new Error("This game is not active.");
    }

    if (game.pendingConquest || game.pendingReinforcements) {
        throw new Error("Complete your pending allocations first.");
    }

    let safetyCounter = 0;

    while (
        game.currentPlayerId !== "human-player" &&
        game.status === "active" &&
        safetyCounter < game.turnOrder.length * 2
    ) {
        safetyCounter++;

        playNpcTurn(gameId);

        // Stop immediately if the game has finished.
        if (game.status !== "active") {
            break;
        }

        // Advance to the next player.
        game.currentTurnIndex++;

        if (game.currentTurnIndex >= game.turnOrder.length) {

            game.currentTurnIndex = 0;
            game.round++;

        }

        game.currentPlayerId =
            game.turnOrder[game.currentTurnIndex];

        const nextPlayer = game.players.find(
            player => player.id === game.currentPlayerId
        );

        if (!nextPlayer || nextPlayer.eliminated) {
            continue;
        }

    }

    if (
        game.status === "active" &&
        game.currentPlayerId === "human-player" &&
        game.round >= 2
    ) {

        const humanCountries = getOwnedCountries(
            game,
            "human-player"
        );

        const reinforcementAmount = humanCountries.length * 2;

        if (reinforcementAmount > 0) {

            game.pendingReinforcements = {
                playerId: "human-player",
                amount: reinforcementAmount
            };

            game.events.push({
                message:
                    `You received ${reinforcementAmount} reinforcement soldiers.`
            });

        }

    }

    return game;

}

function advanceNpcTurnsUntilHuman(gameId) {

    const game = getGameById(gameId);

    if (!game) {
        throw new Error("Game not found.");
    }

    let safetyCounter = 0;

    while (
        game.currentPlayerId !== "human-player" &&
        game.status === "active" &&
        safetyCounter < game.turnOrder.length
    ) {

        safetyCounter++;

        const currentPlayer = game.players.find(
            player => player.id === game.currentPlayerId
        );

        if (!currentPlayer) {
            break;
        }

        const ownedCountries = game.countries.filter(
            country => country.ownerId === currentPlayer.id
        );

        // Skip eliminated players.
        if (ownedCountries.length === 0) {

            currentPlayer.eliminated = true;

        } else {

            // Execute the NPC's turn.
            playNpcTurn(gameId);

        }

        if (game.status !== "active") {
            break;
        }

        // Advance to the next player.
        game.currentTurnIndex++;

        if (game.currentTurnIndex >= game.turnOrder.length) {

            game.currentTurnIndex = 0;
            game.round++;

        }

        game.currentPlayerId = game.turnOrder[game.currentTurnIndex];

    }

    game.events.push({
        message: "It is now your turn!"
    });

}

function checkGameStatus(game) {

    // Do not check a game that has already finished.
    if (!game || game.status !== "active") {
        return game;
    }

    // Find all players who still own countries.
    const activePlayerIds = [
        ...new Set(
            game.countries.map(country => country.ownerId)
        )
    ];

    // Update elimination status.
    game.players.forEach(player => {

        const ownedCountries = game.countries.filter(
            country => country.ownerId === player.id
        );

        if (ownedCountries.length === 0 && !player.eliminated) {

            player.eliminated = true;

            game.events.push({
                message: `${player.name} has been eliminated!`
            });

        }

    });

    // Check whether only one player remains.
    if (activePlayerIds.length === 1) {

        game.status = "finished";

        game.winnerId = activePlayerIds[0];

        const winner = game.players.find(
            player => player.id === game.winnerId
        );

        game.events.push({
            message: `${winner.name} has won the game!`
        });

    }

    return game;

} 