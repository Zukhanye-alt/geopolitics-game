// Generate varied battle commentary based on actual battle results.

export function generateBattleCommentary(battle) {

    if (!battle) {
        return "No battle information is available.";
    }

    const attacker = battle.attackerCountry;
    const defender = battle.defenderCountry;

    const attackerName =
        typeof attacker === "string" ? attacker : attacker?.name;

    const defenderName =
        typeof defender === "string" ? defender : defender?.name;

    const attackerLosses = battle.attackerLosses ?? 0;
    const defenderLosses = battle.defenderLosses ?? 0;

    const messages = [];

    if (battle.conquered) {

        messages.push(
            `${attackerName} has successfully conquered ${defenderName}!`
        );

        messages.push(
            `${attackerName}'s forces have overwhelmed the defenders of ${defenderName}.`
        );

        messages.push(
            `A decisive victory for ${attackerName}! ${defenderName} has fallen.`
        );

    } else if (attackerLosses > defenderLosses) {

        messages.push(
            `${defenderName} successfully resisted the attack, inflicting heavier losses on ${attackerName}.`
        );

        messages.push(
            `${attackerName} suffered more casualties in the battle against ${defenderName}.`
        );

    } else if (defenderLosses > attackerLosses) {

        messages.push(
            `${attackerName} gained the advantage against ${defenderName}.`
        );

        messages.push(
            `${defenderName} suffered heavier casualties during the attack.`
        );

    } else {

        messages.push(
            `The battle between ${attackerName} and ${defenderName} ended with equal casualties.`
        );

        messages.push(
            `Neither side gained a clear advantage in the battle.`
        );

    }

    const randomIndex = Math.floor(
        Math.random() * messages.length
    );

    return messages[randomIndex];
}


// Generate commentary when a country is conquered.

export function generateConquestCommentary(
    attackerName,
    defenderName,
    reward
) {

    return `${attackerName} has conquered ${defenderName}! ` +
        `The victorious forces receive ${reward} reinforcement soldiers.`;
}


// Explain an NPC's strategic decision.

export function generateNpcDecisionCommentary(
    npcName,
    decision,
    reason
) {

    return `${npcName}: ${decision}. Reason: ${reason}`;
} 