import express from "express";

import {
    getCountriesWithSoldiers,
    selectRandomCountries
} from "../services/countryService.js";

const router = express.Router();

// TEST 1: Get all countries
router.get("/", (req, res) => {
    const countryList = getCountriesWithSoldiers();

    res.json(countryList);
});

// TEST 2: Get nine random countries
router.get("/random/:startingCountry", (req, res) => {
    try {
        const selectedCountries = selectRandomCountries(
            req.params.startingCountry
        );

        res.json(selectedCountries);

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
});

export default router;