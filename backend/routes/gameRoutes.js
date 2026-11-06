import express from "express";

import { authenticateUser } from "../middleware/authMiddleware.js";

import {
    createGame,
    getGameById,
    skipTurn,
    transferSoldiers,
    resolveAttack,
    allocateConquestReward,
    allocateReinforcements,
    playNpcTurn,
    fastForwardToHuman,
    loadGameFromDatabase,
    saveGameToDatabase,
    getAvailableGames
} from "../services/gameService.js";

const router = express.Router();

// PUBLIC: Retrieve all available games.
router.get("/", async (req, res) => {

    try {
        const availableGames = await getAvailableGames();

        res.json(availableGames);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

});

// Check whether the logged-in user owns the requested game.
async function verifyGameOwnership(req, res, next) {

    try {

        const gameId = req.params.gameId;

        // Load the game from MongoDB or the in-memory cache.
        await loadGameFromDatabase(gameId);

        const game = getGameById(gameId);

        if (!game) {
            return res.status(404).json({
                message: "Game not found."
            });
        }

        // Compare the game's owner with the logged-in user.
        if (game.ownerUserId !== req.userId) {
            return res.status(403).json({
                message: "You do not have permission to control this game."
            });
        }

        // Make the game available to the next route.
        req.game = game;

        next();

    } catch (error) {

        console.error("Game ownership verification error:", error);

        res.status(500).json({
            message: "Could not verify game ownership."
        });

    }

}


// Create a new game.
// Only logged-in users can create games.
router.post("/", authenticateUser, async (req, res) => {

    try {

        const { selectedCountries, startingCountry } = req.body;

        if (!Array.isArray(selectedCountries)) {
            return res.status(400).json({
                message: "Selected countries must be provided."
            });
        }

        const game = createGame(
            selectedCountries,
            startingCountry,
            req.userId
        );

        await saveGameToDatabase(game);

        res.status(201).json(game);

    } catch (error) {

        console.error("Game creation error:", error);

        res.status(400).json({
            message: error.message
        });

    }

});


// Retrieve a game.
// Visitors are allowed to view games.
router.get("/:gameId", async (req, res) => {

    try {

        const gameId = req.params.gameId;

        await loadGameFromDatabase(gameId);

        const game = getGameById(gameId);

        if (!game) {
            return res.status(404).json({
                message: "Game not found."
            });
        }

        const { ownerUserId, ...publicGame } = game;

        res.json(publicGame); 

    } catch (error) {

        console.error("Game retrieval error:", error);

        res.status(500).json({
            message: "Could not retrieve the game."
        });

    }

});


// Skip the human player's turn.
router.post(
    "/:gameId/skip-turn",
    authenticateUser,
    verifyGameOwnership,
    async (req, res) => {

        try {

            const game = skipTurn(req.params.gameId);

            await saveGameToDatabase(game);

            res.json(game);

        } catch (error) {

            res.status(400).json({
                message: error.message
            });

        }

    }
);


// Transfer soldiers.
router.post(
    "/:gameId/transfer",
    authenticateUser,
    verifyGameOwnership,
    async (req, res) => {

        try {

            const {
                fromCountry,
                toCountry,
                amount
            } = req.body;

            const game = transferSoldiers(
                req.params.gameId,
                fromCountry,
                toCountry,
                amount
            );

            await saveGameToDatabase(game);

            res.json(game);

        } catch (error) {

            res.status(400).json({
                message: error.message
            });

        }

    }
);


// Attack another country.
router.post(
    "/:gameId/attack",
    authenticateUser,
    verifyGameOwnership,
    async (req, res) => {

        try {

            const {
                attackerCountry,
                defenderCountry
            } = req.body;

            const game = resolveAttack(
                req.params.gameId,
                attackerCountry,
                defenderCountry
            );

            await saveGameToDatabase(game);

            res.json(game);

        } catch (error) {

            res.status(400).json({
                message: error.message
            });

        }

    }
);


// Allocate conquest reward.
router.post(
    "/:gameId/conquest-reward",
    authenticateUser,
    verifyGameOwnership,
    async (req, res) => {

        try {

            const { transferAmount } = req.body;

            const game = allocateConquestReward(
                req.params.gameId,
                transferAmount
            );

            await saveGameToDatabase(game);

            res.json(game);

        } catch (error) {

            res.status(400).json({
                message: error.message
            });

        }

    }
);


// Allocate reinforcement soldiers.
router.post(
    "/:gameId/reinforcements",
    authenticateUser,
    verifyGameOwnership,
    async (req, res) => {

        try {

            const { allocations } = req.body;

            const game = allocateReinforcements(
                req.params.gameId,
                allocations
            );

            await saveGameToDatabase(game);

            res.json(game);

        } catch (error) {

            res.status(400).json({
                message: error.message
            });

        }

    }
);


// Execute one NPC turn.
router.post(
    "/:gameId/npc-turn",
    authenticateUser,
    verifyGameOwnership,
    async (req, res) => {

        try {

            const game = playNpcTurn(req.params.gameId);

            await saveGameToDatabase(game);

            res.json(game);

        } catch (error) {

            res.status(400).json({
                message: error.message
            });

        }

    }
);


// Fast-forward until the human player's next turn.
router.post(
    "/:gameId/fast-forward",
    authenticateUser,
    verifyGameOwnership,
    async (req, res) => {

        try {

            const game = fastForwardToHuman(req.params.gameId);

            await saveGameToDatabase(game);

            res.json(game);

        } catch (error) {

            res.status(400).json({
                message: error.message
            });

        }

    }
);


export default router;