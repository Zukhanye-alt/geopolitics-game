import { countries } from "../data/countries.js";

// Calculate the initial number of soldiers based on population.
export function calculateSoldiers(population) {
    const populationInMillions = population / 1000000;

    if (populationInMillions <= 5) return 1;
    if (populationInMillions <= 10) return 2;
    if (populationInMillions <= 25) return 3;
    if (populationInMillions <= 50) return 4;
    if (populationInMillions <= 75) return 5;
    if (populationInMillions <= 100) return 6;
    if (populationInMillions <= 125) return 7;
    if (populationInMillions <= 150) return 8;

    return 9;
}

// Add the initial soldier allocation to every country.
export function getCountriesWithSoldiers() {
    return countries.map(country => ({
        ...country,
        soldiers: calculateSoldiers(country.population)
    }));
}

// Select nine random countries, excluding the player's starting country.
export function selectRandomCountries(startingCountryName) {
    const availableCountries = getCountriesWithSoldiers()
        .filter(country => country.name !== startingCountryName);

    if (!countries.some(country => country.name === startingCountryName)) {
        throw new Error("The selected starting country does not exist.");
    }

    const shuffledCountries = [...availableCountries]
        .sort(() => Math.random() - 0.5);

    return shuffledCountries.slice(0, 9);
}
