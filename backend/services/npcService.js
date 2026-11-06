// NPC decision-making service.

// Find all countries owned by a particular player.
export function getOwnedCountries(game, playerId) {

    return game.countries.filter(
        country => country.ownerId === playerId
    );

}


// Find all countries owned by opponents.
export function getEnemyCountries(game, playerId) {

    return game.countries.filter(
        country => country.ownerId !== playerId &&
            country.soldiers > 0
    );

}


// Choose the strongest country available for an attack.
export function chooseAttackingCountry(game, playerId) {

    const ownedCountries = getOwnedCountries(game, playerId);

    if (ownedCountries.length === 0) {
        return null;
    }

    // Calculate the average number of soldiers across owned countries.
    const totalSoldiers = ownedCountries.reduce(
        (total, country) => total + country.soldiers,
        0
    );

    const averageSoldiers = totalSoldiers / ownedCountries.length;

    // Only consider countries with at least two soldiers.
    const possibleAttackers = ownedCountries.filter(
        country => country.soldiers >= 2
    );

    if (possibleAttackers.length === 0) {
        return null;
    }

    // Score each country based on how many soldiers it can spare.
    const scoredCountries = possibleAttackers.map(country => {

        const defensiveReserve = Math.max(
            1,
            Math.floor(averageSoldiers / 2)
        );

        const availableSoldiers = Math.max(
            0,
            country.soldiers - defensiveReserve
        );

        return {
            country,
            score: availableSoldiers
        };

    });

    // Choose the country with the greatest available attacking force.
    scoredCountries.sort(
        (a, b) => b.score - a.score
    );

    return scoredCountries[0].country;
} 

// Choose an enemy country using strategic target selection.
export function chooseTargetCountry(game, playerId) {

    const enemyCountries = getEnemyCountries(game, playerId);

    if (enemyCountries.length === 0) {
        return null;
    }

    const scoredTargets = enemyCountries.map(country => {

        // A stronger defence makes a country less attractive.
        const defencePenalty = country.soldiers * 2;

        // Estimate the reward for conquering this country.
        const conquestReward = Math.max(
            2,
            Math.floor(country.originalSoldiers / 2)
        );

        // Avoid repeatedly targeting recently conquered territories.
        let recentConquestPenalty = 0;

        if (
            country.lastConqueredRound !== undefined &&
            game.round - country.lastConqueredRound <= 1
        ) {
            recentConquestPenalty = 5;
        }

        const score =
            conquestReward -
            defencePenalty -
            recentConquestPenalty;

        return {
            country,
            score
        };

    });

    scoredTargets.sort(
        (a, b) => b.score - a.score
    );

    return scoredTargets[0].country;
} 


// Decide whether an attack is worthwhile.
export function shouldNpcAttack(attacker, defender) {

    if (!attacker || !defender) {
        return false;
    }

    if (attacker.soldiers < 2) {
        return false;
    }

    // Require a meaningful numerical advantage.
    if (attacker.soldiers <= defender.soldiers) {
        return false;
    }

    return true;
} 


// Choose where an NPC should allocate its reinforcements.
export function chooseReinforcementCountry(game, playerId) {

    const ownedCountries = getOwnedCountries(game, playerId);

    if (ownedCountries.length === 0) {
        return null;
    }

    // Sort countries from weakest to strongest.
    const sortedCountries = [...ownedCountries].sort(
        (a, b) => a.soldiers - b.soldiers
    );

    const weakestCountry = sortedCountries[0];

    const strongestCountry =
        sortedCountries[sortedCountries.length - 1];

    // If the weakest country has less than 60% of
    // the strongest country's soldiers, strengthen it.
    if (
        weakestCountry.soldiers <
        strongestCountry.soldiers * 0.6
    ) {
        return weakestCountry;
    }

    // Otherwise, strengthen the strongest country
    return strongestCountry;

}

