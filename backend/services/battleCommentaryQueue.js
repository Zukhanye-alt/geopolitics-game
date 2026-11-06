// Stores battles that need AI-generated commentary.

const pendingBattles = new Map();


// Add a battle to the queue.
export function enqueueBattleCommentary(gameId, battleContext) {

    if (!pendingBattles.has(gameId)) {
        pendingBattles.set(gameId, []);
    }

    pendingBattles.get(gameId).push({
        ...battleContext,
        queuedAt: new Date().toISOString()
    });

}


// Retrieve pending battles without removing them.
export function getPendingBattleCommentary(gameId) {

    return pendingBattles.get(gameId) || [];

}


// Remove processed battles from the queue.
export function clearPendingBattleCommentary(gameId) {

    pendingBattles.delete(gameId);

} 

// Remove one successfully processed battle from the queue.
export function removePendingBattleCommentary(gameId, queuedAt) {

    const battles = pendingBattles.get(gameId);

    if (!battles) {
        return;
    }

    const updatedBattles = battles.filter(
        battle => battle.queuedAt !== queuedAt
    );

    if (updatedBattles.length === 0) {
        pendingBattles.delete(gameId);
    } else {
        pendingBattles.set(gameId, updatedBattles);
    }

} 