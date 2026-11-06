import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

function getStoredUser() { 
    try {
        return JSON.parse(
            sessionStorage.getItem("user") || "null"
        );
    } catch {
        sessionStorage.removeItem("user");
        return null;
    }
}

function App() {
    const [countries, setCountries] = useState([]);
    const [startingCountry, setStartingCountry] = useState("");
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [game, setGame] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [creatingGame, setCreatingGame] = useState(false);
    const [fromCountry, setFromCountry] = useState("");
    const [toCountry, setToCountry] = useState("");
    const [transferAmount, setTransferAmount] = useState(1);
    const [attackerCountry, setAttackerCountry] = useState("");
    const [defenderCountry, setDefenderCountry] = useState("");
    const [conquestTransferAmount, setConquestTransferAmount] = useState(0);
    const [reinforcementAllocations, setReinforcementAllocations] = useState({});
    const [activeAttack, setActiveAttack] = useState(null);
    const [processingAction, setProcessingAction] = useState(false);
    const [token, setToken] = useState(sessionStorage.getItem("token") || "");

    const [user, setUser] = useState(getStoredUser());

    const [authMode, setAuthMode] = useState("login");
    const [authLoading, setAuthLoading] = useState(false);
    const [authMessage, setAuthMessage] = useState("");

    const [authForm, setAuthForm] = useState({
        username: "",
        email: "",
        password: ""
    });

    // PHASE 24: GAME LOBBY

    const [lobbyGames, setLobbyGames] = useState([]);

    const [isSpectator, setIsSpectator] = useState(false);

    async function handleRegister(event) {
        event.preventDefault();

        setAuthMessage("");
        setAuthLoading(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(authForm)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Registration failed.");
            }

            setAuthMessage("Account created successfully. Please log in.");
            setAuthMode("login");

            setAuthForm({
                username: "",
                email: authForm.email,
                password: ""
            });

        } catch (error) {
            setAuthMessage(error.message);
        } finally {
            setAuthLoading(false);
        }
    }

    async function handleLogin(event) {
        event.preventDefault();

        setAuthMessage("");
        setAuthLoading(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: authForm.email,
                        password: authForm.password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed.");
            }

            sessionStorage.setItem("token", data.token);
            sessionStorage.setItem("user", JSON.stringify(data.user));

            setToken(data.token);
            setUser(data.user);

            setAuthMessage("");

            setAuthForm({
                username: "",
                email: "",
                password: ""
            });

        } catch (error) {
            setAuthMessage(error.message);
        } finally {
            setAuthLoading(false);
        }
    }

    function handleLogout() {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        setToken("");
        setUser(null);

        setGame(null);
        setStartingCountry("");
        setSelectedCountries([]);

        setAuthMessage("");
        setAuthMode("login");

        setIsSpectator(false); 
    }

    function getAuthHeaders() {
        return {
            Authorization: `Bearer ${token}`
        };
    }

    // Load available countries.
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/countries`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Could not load countries.");
                }

                return response.json();
            })
            .then(data => {
                setCountries(data);
                setLoading(false);
            })
            .catch(error => {
                setError(error.message);
                setLoading(false);
            });
    }, []);

    //Automatically load public games.
    useEffect(() => {

        fetchPublicGames();

        const interval = setInterval(() => {
            fetchPublicGames();
        }, 15000);

        return () => clearInterval(interval);

    }, []);

    // Automatically refresh a game while watching it.
    useEffect(() => {

        if (!isSpectator || !game?.id) {
            return;
        }

        const interval = setInterval(async () => {

            try {

                const response = await fetch(
                    `${API_BASE_URL}/api/games/${game.id}`
                );

                if (!response.ok) {
                    throw new Error("Could not refresh the game.");
                }

                const updatedGame = await response.json();

                setGame(updatedGame);

            } catch (error) {

                console.error("Spectator refresh error:", error.message);

            }

        }, 10000);

        return () => clearInterval(interval);

    }, [isSpectator, game?.id]); 

    // Generate nine random countries.
    async function handleCountrySelection() {
        if (!startingCountry) {
            setError("Please select a starting country.");
            return;
        }

        setError("");
        setGame(null);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/countries/random/${encodeURIComponent(startingCountry)}`
            );

            if (!response.ok) {
                throw new Error("Could not generate countries.");
            }

            const data = await response.json();

            const startingCountryData = countries.find(
                country => country.name === startingCountry
            );

            setSelectedCountries([
                startingCountryData,
                ...data
            ]);

        } catch (error) {
            setError(error.message);
        }
    }

    // Create a new game.
    async function handleStartGame() {
        setError("");
        setCreatingGame(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/games`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        selectedCountries,
                        startingCountry
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Could not create game.");
            }

            setGame(data);
            setIsSpectator(false);

        } catch (error) {
            setError(error.message);

        } finally {
            setCreatingGame(false);
        }
    }

    async function handleSkipTurn() {
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/games/${game.id}/skip-turn`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthHeaders()
                    }
                }
            );

            const data = await response.json();
            console.log("Updated game:", data);
            console.log("Game events:", data.events);
            console.log("Current player:", data.currentPlayerId);

            if (!response.ok) {
                throw new Error(data.message || "Could not skip turn.");
            }

            setGame(data);
        } catch (error) {
            setError(error.message);
        }
    }

    // Fast-forward through NPC turns.
    async function handleFastForward() {

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/games/${game.id}/fast-forward`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthHeaders()
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Fast-forward failed.");
            }

            setGame(data);

            setError("");

        } catch (error) {

            setError(error.message);

        }

    }

    async function handleTransfer() {
        if (game.currentPlayerId !== "human-player") {
            setError("You can only transfer soldiers during your turn.");
            return;
        }

        if (game.pendingConquest || game.pendingReinforcements) {
            setError("Complete your pending allocations first.");
            return;
        }
        try {
            setProcessingAction(true);
            const response = await fetch(
                `${API_BASE_URL}/api/games/${game.id}/transfer`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        fromCountry,
                        toCountry,
                        amount: Number(transferAmount)
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Transfer failed.");
            }

            setGame(data);
            setError("");
            setTransferAmount(1);

        } catch (error) {
            setError(error.message);
        }
        finally {
            setProcessingAction(false);
        }
    }

    // Handle an attack.
    async function handleAttack() {

        if (processingAction) {
            return;
        }

        if (game.status !== "active") {
            setError("This game has already finished.");
            return;
        }

        if (game.currentPlayerId !== "human-player") {
            setError("It is not your turn.");
            return;
        }

        if (game.pendingConquest || game.pendingReinforcements) {
            setError("Complete your pending allocations before attacking.");
            return;
        }

        if (!attackerCountry || !defenderCountry) {
            setError("Please select both an attacking and defending country.");
            return;
        }

        setProcessingAction(true);

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/games/${game.id}/attack`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        attackerCountry,
                        defenderCountry
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Attack failed.");
            }

            setGame(data);
            setError("");

            // Check whether the battle can continue.
            const attacker = data.countries.find(
                country => country.name === attackerCountry
            );

            const defender = data.countries.find(
                country => country.name === defenderCountry
            );

            if (
                attacker &&
                defender &&
                attacker.ownerId === "human-player" &&
                attacker.soldiers >= 2 &&
                defender.ownerId !== "human-player" &&
                defender.soldiers > 0 &&
                !data.pendingConquest
            ) {

                setActiveAttack({
                    attackerCountry,
                    defenderCountry
                });

            } else {

                setActiveAttack(null);

            }

        } catch (error) {

            setError(error.message);

        } finally {

            setProcessingAction(false);

        }
    }

    // Stop an ongoing attack.
    function handleStopAttack() {

        setActiveAttack(null);

        setAttackerCountry("");
        setDefenderCountry("");

        setError("");
    }

    // Handle conquest reward allocation.
    async function handleConquestReward() {

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/games/${game.id}/conquest-reward`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthHeaders()
                    },

                    body: JSON.stringify({
                        transferAmount: Number(conquestTransferAmount)
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Reward allocation failed.");
            }

            setGame(data);

            setConquestTransferAmount(0);

            setError("");

        } catch (error) {

            setError(error.message);

        }

    }

    // Handle reinforcement allocation.
    async function handleReinforcementAllocation() {

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/games/${game.id}/reinforcements`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthHeaders()
                    },

                    body: JSON.stringify({
                        allocations: Object.fromEntries(
                            Object.entries(reinforcementAllocations).map(
                                ([country, amount]) => [
                                    country,
                                    Number(amount)
                                ]
                            )
                        )
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Reinforcement allocation failed.");
            }

            setGame(data);

            setReinforcementAllocations({});

            setError("");

        } catch (error) {

            setError(error.message);

        }

    }

    // Retrieve available games for the public lobby.
    async function fetchPublicGames() {

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/games`
            );

            if (!response.ok) {
                throw new Error("Could not retrieve available games.");
            }

            const data = await response.json();

            setLobbyGames(data);

        } catch (error) {

            console.error("Lobby error:", error.message);

        }

    }

    // Open an existing game in spectator mode.
    async function handleViewGame(gameId) {

        try {

            setError("");

            const response = await fetch(
                `${API_BASE_URL}/api/games/${gameId}`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Could not load this game."
                );
            }

            setGame(data);

            // Visitors can only watch games opened through the lobby.
            setIsSpectator(true);

        } catch (error) {

            setError(error.message);

        }

    }

    if (loading) {
        return <h2>Loading countries...</h2>;
    }

    return (
        <div className={`app ${isSpectator ? "spectator-mode" : ""}`}>

            <h1>GEOPOLITICS</h1>

            {!token && !isSpectator ? (

                <>

                    {/* PUBLIC GAME LOBBY */}

                    <section className="lobby-section">

                        <h2>PUBLIC GAME LOBBY</h2>

                        <p>
                            Browse existing games and watch them in progress.
                            You do not need an account to watch.
                        </p>

                        <button onClick={fetchPublicGames}>
                            REFRESH GAMES
                        </button>

                        <div className="lobby-game-list">

                            {lobbyGames.length === 0 ? (

                                <p>No games are currently available.</p>

                            ) : (

                                lobbyGames.map((lobbyGame) => (

                                    <div
                                        className="lobby-game-card"
                                        key={lobbyGame.id}
                                    >

                                        <h3>
                                            Game {lobbyGame.id.slice(0, 8)}
                                        </h3>

                                        <p>
                                            Status: {lobbyGame.status}
                                        </p>

                                        <p>
                                            Round: {lobbyGame.round}
                                        </p>

                                        <p>
                                            Players: {lobbyGame.playerCount}
                                        </p>

                                        <p>
                                            Countries: {lobbyGame.countryCount}
                                        </p>

                                        <p>
                                            Current turn: {lobbyGame.currentPlayerName}
                                        </p>

                                        <button
                                            onClick={() => handleViewGame(lobbyGame.id)}
                                        >
                                            WATCH GAME
                                        </button>

                                    </div>

                                ))

                            )}

                        </div>

                    </section>

                    {/* LOGIN AND REGISTRATION */}

                    <div className="auth-container">

                        <h2>
                            {authMode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
                        </h2>

                        <p>
                            {authMode === "login"
                                ? "Log in to continue your campaign."
                                : "Create an account to start playing."}
                        </p>

                        <form
                            onSubmit={authMode === "login" ? handleLogin : handleRegister}
                        >

                            {authMode === "register" && (

                                <div className="auth-input">

                                    <label>Username:</label>

                                    <input
                                        type="text"
                                        placeholder="Enter your username"
                                        value={authForm.username}
                                        onChange={event =>
                                            setAuthForm({
                                                ...authForm,
                                                username: event.target.value
                                            })
                                        }
                                        minLength="3"
                                        maxLength="30"
                                        required
                                    />

                                </div>

                            )}

                            <div className="auth-input">

                                <label>Email:</label>

                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={authForm.email}
                                    onChange={event =>
                                        setAuthForm({
                                            ...authForm,
                                            email: event.target.value
                                        })
                                    }
                                    required
                                />

                            </div>

                            <div className="auth-input">

                                <label>Password:</label>

                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={authForm.password}
                                    onChange={event =>
                                        setAuthForm({
                                            ...authForm,
                                            password: event.target.value
                                        })
                                    }
                                    minLength="8"
                                    required
                                />

                            </div>

                            <button type="submit" disabled={authLoading}>

                                {authLoading
                                    ? "PLEASE WAIT..."
                                    : authMode === "login"
                                        ? "LOGIN"
                                        : "CREATE ACCOUNT"}

                            </button>

                        </form>

                        {authMessage && (

                            <p className="auth-message">
                                {authMessage}
                            </p>

                        )}

                        <div className="auth-switch">

                            {authMode === "login" ? (

                                <p>
                                    Don't have an account?

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthMode("register");
                                            setAuthMessage("");
                                        }}
                                    >
                                        Register here
                                    </button>
                                </p>

                            ) : (

                                <p>
                                    Already have an account?

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthMode("login");
                                            setAuthMessage("");
                                        }}
                                    >
                                        Login here
                                    </button>
                                </p>

                            )}

                        </div>

                    </div>

                </>

            ) : (
                <>
                    {token && (
                        <div className="auth-user-bar">

                            <h3>
                                Welcome, {user?.username}!
                            </h3>

                            <button onClick={handleLogout}>
                                LOG OUT
                            </button>

                        </div>
                    )}

                    {token && !game && (

                        <>

                            {/*PUBLIC GAME LOBBY */}

                            <section className="lobby-section">

                                <h2>GAME LOBBY</h2>

                                <p>
                                    Browse existing games and watch them in progress.
                                </p>

                                <button onClick={fetchPublicGames}>
                                    REFRESH GAMES
                                </button>

                                <div className="lobby-game-list">

                                    {lobbyGames.length === 0 ? (

                                        <p>No games are currently available.</p>

                                    ) : (

                                        lobbyGames.map((lobbyGame) => (

                                            <div
                                                className="lobby-game-card"
                                                key={lobbyGame.id}
                                            >

                                                <h3>
                                                    Game {lobbyGame.id.slice(0, 8)}
                                                </h3>

                                                <p>
                                                    Status: {lobbyGame.status}
                                                </p>

                                                <p>
                                                    Round: {lobbyGame.round}
                                                </p>

                                                <p>
                                                    Players: {lobbyGame.playerCount}
                                                </p>

                                                <p>
                                                    Countries: {lobbyGame.countryCount}
                                                </p>

                                                <p>
                                                    Current turn: {lobbyGame.currentPlayerName}
                                                </p>

                                                <button
                                                    onClick={() => handleViewGame(lobbyGame.id)}
                                                >
                                                    WATCH GAME
                                                </button>

                                            </div>

                                        ))

                                    )}

                                </div>

                            </section>
                            <h2>Choose Your Starting Country</h2>

                            <p>
                                Select the country you want to begin your campaign with.
                            </p>

                            <select
                                value={startingCountry}
                                onChange={event => {
                                    setStartingCountry(event.target.value);
                                    setSelectedCountries([]);
                                    setGame(null);
                                    setError("");
                                }}
                            >
                                <option value="">-- Select a country --</option>

                                {countries.map(country => (
                                    <option key={country.name} value={country.name}>
                                        {country.name}
                                    </option>
                                ))}
                            </select>

                            <br />

                            <button onClick={handleCountrySelection}>
                                Generate Countries
                            </button>

                            {selectedCountries.length > 0 && (
                                <div className="country-list">

                                    <h2>Your Game Countries</h2>

                                    <p>
                                        These are the ten countries participating in your game.
                                    </p>

                                    {selectedCountries.map((country, index) => (
                                        <div className="country-card" key={country.name}>
                                            <h3>
                                                {index === 0 ? "Your Country" : `Country ${index + 1}`}
                                                : {country.name}
                                            </h3>

                                            <p>
                                                Population: {country.population.toLocaleString()}
                                            </p>

                                            <p>
                                                Initial Soldiers: {country.soldiers}
                                            </p>
                                        </div>
                                    ))}

                                    <button
                                        onClick={handleStartGame}
                                        disabled={creatingGame}
                                    >
                                        {creatingGame ? "Creating Game..." : "Start Game"}
                                    </button>

                                </div>
                            )}
                        </>
                    )}

                    {error && <p className="error">{error}</p>}

                    {game && (
                        <div className="game-board">

                            {isSpectator && (
                                <div className="spectator-banner">

                                    <h2>SPECTATOR MODE</h2>

                                    <p>
                                        You are currently watching this game.
                                        You cannot perform game actions.
                                    </p>

                                    <button onClick={() => {

                                        setGame(null);
                                        setIsSpectator(false);
                                        fetchPublicGames();

                                    }}>
                                        RETURN TO LOBBY
                                    </button>

                                </div>
                            )}

                            <h2>YOUR GAME HAS STARTED!</h2>

                            <div className="game-dashboard">

                                <div className="dashboard-card">
                                    <h3>ROUND</h3>
                                    <p>{game.round}</p>
                                </div>

                                <div className="dashboard-card">
                                    <h3>
                                        {isSpectator ? "HUMAN PLAYER'S COUNTRIES" : "YOUR COUNTRIES"}
                                    </h3>
                                    <p>
                                        {game.countries.filter(
                                            country => country.ownerId === "human-player"
                                        ).length}
                                    </p>
                                </div>

                                <div className="dashboard-card">
                                    <h3>
                                        {isSpectator ? "HUMAN PLAYER'S SOLDIERS" : "YOUR SOLDIERS"}
                                    </h3>
                                    <p>
                                        {game.countries
                                            .filter(country => country.ownerId === "human-player")
                                            .reduce((total, country) => total + country.soldiers, 0)}
                                    </p>
                                </div>

                                <div className="dashboard-card">
                                    <h3>GAME STATUS</h3>
                                    <p>
                                        {game.status === "active" ? "ACTIVE" : "FINISHED"}
                                    </p>
                                </div>

                            </div>

                            {game.status === "finished" && (

                                <div className="game-over">

                                    <h1>GAME OVER</h1>

                                    {game.winnerId === "human-player" ? (

                                        <h2>CONGRATULATIONS! YOU WON!</h2>

                                    ) : (

                                        <h2>YOUR CAMPAIGN HAS ENDED.</h2>

                                    )}

                                    <p>
                                        {game.players.find(
                                            player => player.id === game.winnerId
                                        )?.name} is the winner!
                                    </p>

                                    <p>
                                        Thank you for playing Geopolitics!
                                    </p>

                                </div>

                            )}

                            <div className="turn-indicator">

                                {game.currentPlayerId === "human-player" ? (
                                    <h2>
                                        {isSpectator
                                            ? "IT IS THE HUMAN PLAYER'S TURN!"
                                            : "IT'S YOUR TURN!"}
                                    </h2>
                                ) : (
                                    <h2>
                                        {game.players.find(
                                            player => player.id === game.currentPlayerId
                                        )?.name}'s Turn
                                    </h2>
                                )}

                            </div>

                            <button
                                className="skip-turn-button"
                                onClick={handleSkipTurn}
                                disabled={
                                    game.currentPlayerId !== "human-player" ||
                                    processingAction ||
                                    Boolean(game.pendingConquest) ||
                                    Boolean(game.pendingReinforcements) ||
                                    game.status !== "active"
                                }
                            >
                                Skip Turn
                            </button>

                            <button
                                className="fast-forward-button"
                                onClick={handleFastForward}
                                disabled={
                                    game.currentPlayerId === "human-player" ||
                                    processingAction ||
                                    game.status !== "active"
                                }
                            >
                                FAST-FORWARD TO MY TURN
                            </button>

                            <h3>Participating Players</h3>

                            <div className="player-list">
                                {game.players.map(player => (
                                    <div className="player-card" key={player.id}>
                                        <h4>{player.name}</h4>

                                        <p>
                                            {player.type === "human" ? "Human Player" : "NPC"}
                                        </p>
                                        <p>
                                            Countries owned: {
                                                game.countries.filter(
                                                    country => country.ownerId === player.id
                                                ).length
                                            }
                                        </p>

                                        <p>
                                            Total soldiers: {
                                                game.countries
                                                    .filter(country => country.ownerId === player.id)
                                                    .reduce(
                                                        (total, country) => total + country.soldiers,
                                                        0
                                                    )
                                            }
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <h3>WORLD MAP: COUNTRY OWNERSHIP</h3>

                            <div className="ownership-legend">

                                <span className="your-territory">
                                    YOUR TERRITORY
                                </span>

                                <span className="enemy-territory">
                                    ENEMY TERRITORY
                                </span>

                            </div>

                            <div className="country-list">

                                {game.countries.map(country => {

                                    const owner = game.players.find(
                                        player => player.id === country.ownerId
                                    );

                                    return (
                                        <div
                                            className={`country-card ${country.ownerId === "human-player"
                                                ? "owned-country"
                                                : "enemy-country"
                                                }`}
                                            key={country.name}
                                        >

                                            <h3>{country.name}</h3>

                                            <p>
                                                Owner: {owner?.name}
                                            </p>

                                            <p>
                                                Population: {country.population.toLocaleString()}
                                            </p>

                                            <p>
                                                Soldiers: {country.soldiers}
                                            </p>

                                            <p>
                                                {country.ownerId === "human-player"
                                                    ? "YOUR TERRITORY"
                                                    : "OPPONENT TERRITORY"}
                                            </p>

                                        </div>
                                    );
                                })}

                            </div>

                            <div className="transfer-section">
                                <h3>Transfer Soldiers</h3>

                                <label>From Country:</label>

                                <select
                                    value={fromCountry}
                                    onChange={event => {
                                        setFromCountry(event.target.value);
                                        setToCountry("");
                                    }}
                                >
                                    <option value="">Select country</option>

                                    {game.countries
                                        .filter(country => country.ownerId === "human-player")
                                        .map(country => (
                                            <option key={country.name} value={country.name}>
                                                {country.name} ({country.soldiers} soldiers)
                                            </option>
                                        ))}
                                </select>

                                <label>To Country:</label>

                                <select
                                    value={toCountry}
                                    onChange={event => setToCountry(event.target.value)}
                                >

                                    <option value="">Select destination country</option>

                                    {game.countries
                                        .filter(country =>
                                            country.ownerId === "human-player" &&
                                            country.name !== fromCountry
                                        )
                                        .map(country => (

                                            <option key={country.name} value={country.name}>
                                                {country.name} ({country.soldiers} soldiers)
                                            </option>

                                        ))}

                                </select>

                                <label>Number of soldiers:</label>

                                <input
                                    type="number"
                                    min="1"
                                    max={
                                        game.countries.find(
                                            country => country.name === fromCountry
                                        )?.soldiers - 1 || 1
                                    }
                                    value={transferAmount}
                                    onChange={event => setTransferAmount(event.target.value)}
                                />

                                <button
                                    onClick={handleTransfer}
                                    disabled={
                                        !fromCountry ||
                                        !toCountry ||
                                        fromCountry === toCountry ||
                                        game.currentPlayerId !== "human-player" ||
                                        processingAction ||
                                        game.status !== "active" ||
                                        Boolean(game.pendingConquest) ||
                                        Boolean(game.pendingReinforcements)
                                    }
                                >
                                    Transfer Soldiers
                                </button>
                            </div>

                            {/* ATTACK SECTION */}

                            <div className="attack-section">

                                <h2>Attack an Enemy Country</h2>

                                <p>
                                    Select one of your countries and choose an enemy country to attack.
                                </p>

                                {game.currentPlayerId !== "human-player" && (

                                    <p className="action-warning">
                                        You can only attack during your turn.
                                    </p>

                                )}

                                {/* Attacking country */}

                                <label>Attacking Country:</label>

                                <select
                                    value={attackerCountry}
                                    onChange={event => {
                                        setAttackerCountry(event.target.value);
                                        setActiveAttack(null);
                                    }}
                                    disabled={
                                        game.currentPlayerId !== "human-player" ||
                                        processingAction ||
                                        Boolean(game.pendingConquest) ||
                                        Boolean(game.pendingReinforcements) ||
                                        game.status !== "active"
                                    }
                                >

                                    <option value="">Select your country</option>

                                    {game.countries
                                        .filter(country =>
                                            country.ownerId === "human-player" &&
                                            country.soldiers >= 2
                                        )
                                        .map(country => (

                                            <option key={country.name} value={country.name}>
                                                {country.name} ({country.soldiers} soldiers)
                                            </option>

                                        ))}

                                </select>

                                <br />

                                {/* Defending country */}

                                <label>Defending Country:</label>

                                <select
                                    value={defenderCountry}
                                    onChange={event => {
                                        setDefenderCountry(event.target.value);
                                        setActiveAttack(null);
                                    }}
                                    disabled={
                                        game.currentPlayerId !== "human-player" ||
                                        processingAction ||
                                        Boolean(game.pendingConquest) ||
                                        Boolean(game.pendingReinforcements) ||
                                        game.status !== "active"
                                    }
                                >

                                    <option value="">Select enemy country</option>

                                    {game.countries
                                        .filter(country =>
                                            country.ownerId !== "human-player" &&
                                            country.soldiers > 0
                                        )
                                        .map(country => (

                                            <option key={country.name} value={country.name}>
                                                {country.name} ({country.soldiers} soldiers)
                                            </option>

                                        ))}

                                </select>

                                <br />

                                {!activeAttack ? (

                                    <button
                                        onClick={handleAttack}
                                        disabled={
                                            !attackerCountry ||
                                            !defenderCountry ||
                                            processingAction ||
                                            game.currentPlayerId !== "human-player" ||
                                            Boolean(game.pendingConquest) ||
                                            Boolean(game.pendingReinforcements) ||
                                            game.status !== "active"
                                        }
                                    >
                                        {processingAction ? "ATTACKING..." : "ATTACK"}
                                    </button>

                                ) : (

                                    <div className="ongoing-attack">

                                        <h3>Battle in Progress!</h3>

                                        <p>
                                            {activeAttack.attackerCountry} is attacking{" "}
                                            {activeAttack.defenderCountry}.
                                        </p>

                                        <button
                                            onClick={handleAttack}
                                            disabled={
                                                processingAction ||
                                                game.status !== "active" ||
                                                game.currentPlayerId !== "human-player"
                                            }
                                        >
                                            {processingAction ? "RESOLVING..." : "CONTINUE ATTACK"}
                                        </button>

                                        <button
                                            onClick={handleStopAttack}
                                            disabled={processingAction}
                                        >
                                            STOP ATTACK
                                        </button>

                                    </div>

                                )}

                            </div>

                            {/* BATTLE RESULTS */}

                            {game.lastBattle && (

                                <div className="battle-results">

                                    <h2>Battle Results</h2>

                                    <h3>
                                        {game.lastBattle.attackerCountry}
                                        {" vs "}
                                        {game.lastBattle.defenderCountry}
                                    </h3>

                                    <div className="dice-results">

                                        <div>
                                            <h3>Attacker Dice</h3>

                                            <p>
                                                {game.lastBattle.attackerDice.join(" | ")}
                                            </p>
                                        </div>

                                        <div>
                                            <h3>Defender Dice</h3>

                                            <p>
                                                {game.lastBattle.defenderDice.join(" | ")}
                                            </p>
                                        </div>

                                    </div>

                                    <h3>Dice Comparisons</h3>

                                    {game.lastBattle.comparisons.map((comparison, index) => (

                                        <div className="comparison-item" key={index}>

                                            <p>
                                                Comparison {index + 1}
                                            </p>

                                            <h3>
                                                {comparison.attackerRoll}
                                                {" vs "}
                                                {comparison.defenderRoll}
                                            </h3>

                                            <p>
                                                {comparison.winner === "attacker"
                                                    ? "Attacker wins!"
                                                    : comparison.winner === "defender"
                                                        ? "Defender wins!"
                                                        : "Tie!"}
                                            </p>

                                        </div>

                                    ))}

                                    <h3>Battle Casualties</h3>

                                    <p>
                                        Attacker losses: {game.lastBattle.attackerLosses}
                                    </p>

                                    <p>
                                        Defender losses: {game.lastBattle.defenderLosses}
                                    </p>

                                    {game.lastBattle.conquered && (

                                        <h2 className="victory-message">
                                            COUNTRY CONQUERED!
                                        </h2>

                                    )}

                                </div>

                            )}

                            {/* GAME EVENT HISTORY */}

                            <div className="event-history">

                                <h2>GAME HISTORY & NPC DECISIONS</h2>

                                {game.events && game.events.length > 0 ? (

                                    <div className="event-list">

                                        {game.events.map((event, index) => (

                                            <div className="event-item" key={index}>

                                                <p>{event.message}</p>

                                            </div>

                                        ))}

                                    </div>

                                ) : (

                                    <p>No events have occurred yet.</p>

                                )}

                            </div>

                            {/* Battle Commentary */}

                            <div className="commentary-panel">

                                <h2>⚔️ Battle Commentary</h2>

                                {game.commentary && game.commentary.length > 0 ? (

                                    <div className="commentary-list">

                                        {[...game.commentary].reverse().map(
                                            (entry, index) => (

                                                <div
                                                    className={`commentary-entry ${entry.type}`}
                                                    key={`${entry.timestamp ?? "entry"}-${index}`}
                                                >

                                                    <small>
                                                        Round {entry.round}
                                                    </small>

                                                    <p>{entry.message}</p>

                                                </div>

                                            )
                                        )}

                                    </div>

                                ) : (

                                    <p>No commentary available yet.</p>

                                )}

                            </div>

                            {/* CONQUEST REWARD SECTION */}

                            {game.pendingConquest && (

                                <div className="conquest-section">

                                    <h2>COUNTRY CONQUERED!</h2>

                                    <h3>
                                        You have conquered {game.pendingConquest.countryName}!
                                    </h3>

                                    <p>
                                        You have received a reward of{" "}
                                        <strong>
                                            {game.pendingConquest.rewardSoldiers} soldiers.
                                        </strong>
                                    </p>

                                    <p>
                                        Choose how many reward soldiers you want to transfer
                                        to your newly conquered country.
                                    </p>

                                    <label>
                                        Soldiers to transfer:
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        max={game.pendingConquest.rewardSoldiers}
                                        step="1"
                                        value={conquestTransferAmount}
                                        onChange={event =>
                                            setConquestTransferAmount(event.target.value)
                                        }
                                    />

                                    <p>
                                        Soldiers remaining in attacking country after reward:
                                        {" "}
                                        {game.countries.find(
                                            country =>
                                                country.name === game.pendingConquest.attackerCountryName
                                        )?.soldiers +
                                            game.pendingConquest.rewardSoldiers -
                                            Number(conquestTransferAmount)}
                                    </p>

                                    <button
                                        onClick={handleConquestReward}
                                        disabled={
                                            game.status !== "active" ||
                                            processingAction ||
                                            !Number.isInteger(Number(conquestTransferAmount)) ||
                                            Number(conquestTransferAmount) < 0 ||
                                            Number(conquestTransferAmount) >
                                            game.pendingConquest.rewardSoldiers

                                        }
                                    >
                                        Confirm Soldier Allocation
                                    </button>

                                </div>

                            )}

                            {/* REINFORCEMENT ALLOCATION SECTION */}

                            {game.pendingReinforcements && (

                                <div className="reinforcement-section">

                                    <h2>REINFORCEMENTS AVAILABLE!</h2>

                                    <p>
                                        You have received{" "}
                                        <strong>
                                            {game.pendingReinforcements.amount} soldiers.
                                        </strong>
                                    </p>

                                    <p>
                                        Distribute your reinforcement soldiers among
                                        your countries.
                                    </p>

                                    {game.countries
                                        .filter(country => country.ownerId === "human-player")
                                        .map(country => (

                                            <div key={country.name} className="reinforcement-country">

                                                <label>
                                                    {country.name} ({country.soldiers} soldiers)
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={reinforcementAllocations[country.name] ?? ""}
                                                    onChange={event =>
                                                        setReinforcementAllocations(previous => ({
                                                            ...previous,
                                                            [country.name]: event.target.value
                                                        }))
                                                    }
                                                />

                                            </div>

                                        ))}

                                    <p>
                                        Soldiers allocated:{" "}
                                        {Object.values(reinforcementAllocations).reduce(
                                            (total, amount) => total + (Number(amount) || 0),
                                            0
                                        )}
                                        {" / "}
                                        {game.pendingReinforcements.amount}
                                    </p>

                                    <p>
                                        Soldiers remaining to allocate:{" "}
                                        {game.pendingReinforcements.amount -
                                            Object.values(reinforcementAllocations).reduce(
                                                (total, amount) => total + (Number(amount) || 0),
                                                0
                                            )}
                                    </p>

                                    <button
                                        onClick={handleReinforcementAllocation}
                                        disabled={
                                            game.status !== "active" ||
                                            processingAction ||
                                            Object.values(reinforcementAllocations).reduce(
                                                (total, amount) => total + (Number(amount) || 0),
                                                0
                                            ) !== game.pendingReinforcements.amount ||
                                            Object.values(reinforcementAllocations).some(
                                                amount =>
                                                    amount === "" ||
                                                    !Number.isInteger(Number(amount)) ||
                                                    Number(amount) < 0
                                            )
                                        }
                                    >
                                        Confirm Reinforcements
                                    </button>

                                </div>

                            )}

                        </div>
                    )}

                </>
            )}

        </div>
    );
}

export default App;