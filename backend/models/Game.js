import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({

    // Unique game identifier.
    id: {
        type: String,
        required: true,
        unique: true
    },

    ownerUserId: {
        type: String,
        required: true,
        index: true
    }, 

    // Current game round.
    round: {
        type: Number,
        default: 1
    },

    // Game status: active or finished.
    status: {
        type: String,
        default: "active"
    },

    // Human player and NPC information.
    players: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    // Countries and their current game information.
    countries: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    // Randomised player turn order.
    turnOrder: {
        type: [String],
        default: []
    },

    // Current turn information.
    currentTurnIndex: {
        type: Number,
        default: 0
    },

    currentPlayerId: {
        type: String,
        required: true
    },

    // Game event history.
    events: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    // Battle and NPC commentary.
    commentary: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    // Pending player allocations.
    pendingReinforcements: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    pendingConquest: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Most recent battle results.
    lastBattle: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Winner information.
    winnerId: {
        type: String,
        default: null
    }

}, {
    timestamps: true
});

// Create or reuse the Game model.
const Game = mongoose.models.Game ||
    mongoose.model("Game", gameSchema);

export default Game; 