/**
 * Space Docking Game - Level Configuration
 * Defines all 10 levels with progressive difficulty
 */

const SpaceDockingLevels = (() => {
    // Level configurations
    const LEVELS = [
        {
            id: 1,
            name: "First Contact",
            station: 'basic',
            stationDistance: 50,
            stationScale: 1.0,
            moving: false,
            moveSpeed: 0,
            obstacles: [],
            fuel: 100,
            dockTolerance: 6.0,
            dockAlignTolerance: 0.5
        },
        {
            id: 2,
            name: "Approach Vector",
            station: 'cross',
            stationDistance: 60,
            stationScale: 1.2,
            moving: false,
            moveSpeed: 0,
            obstacles: [],
            fuel: 100,
            dockTolerance: 5.5,
            dockAlignTolerance: 0.48
        },
        {
            id: 3,
            name: "Moving Target",
            station: 'ring',
            stationDistance: 70,
            stationScale: 1.4,
            moving: true,
            moveSpeed: 0.3,
            movePattern: 'linear',
            obstacles: [],
            fuel: 95,
            dockTolerance: 5.0,
            dockAlignTolerance: 0.45
        },
        {
            id: 4,
            name: "Orbital Dance",
            station: 'multi',
            stationDistance: 80,
            stationScale: 1.6,
            moving: true,
            moveSpeed: 0.5,
            movePattern: 'orbit',
            obstacles: [],
            fuel: 90,
            dockTolerance: 4.5,
            dockAlignTolerance: 0.42
        },
        {
            id: 5,
            name: "Asteroid Field",
            station: 'large',
            stationDistance: 70,
            stationScale: 1.8,
            moving: false,
            moveSpeed: 0,
            obstacles: ['asteroids'],
            asteroidCount: 8,
            fuel: 85,
            dockTolerance: 5.0,
            dockAlignTolerance: 0.45
        },
        {
            id: 6,
            name: "Debris Navigation",
            station: 'cruiser',
            stationDistance: 80,
            stationScale: 2.0,
            moving: true,
            moveSpeed: 0.4,
            movePattern: 'linear',
            obstacles: ['asteroids'],
            asteroidCount: 12,
            fuel: 80,
            dockTolerance: 4.5,
            dockAlignTolerance: 0.42
        },
        {
            id: 7,
            name: "Satellite Hazard",
            station: 'carrier',
            stationDistance: 85,
            stationScale: 2.2,
            moving: true,
            moveSpeed: 0.5,
            movePattern: 'orbit',
            obstacles: ['satellites'],
            satelliteCount: 4,
            fuel: 75,
            dockTolerance: 4.0,
            dockAlignTolerance: 0.4
        },
        {
            id: 8,
            name: "Traffic Control",
            station: 'battleship',
            stationDistance: 90,
            stationScale: 2.5,
            moving: true,
            moveSpeed: 0.6,
            movePattern: 'figure8',
            obstacles: ['asteroids', 'satellites'],
            asteroidCount: 10,
            satelliteCount: 3,
            fuel: 70,
            dockTolerance: 3.5,
            dockAlignTolerance: 0.38
        },
        {
            id: 9,
            name: "Rescue Mission",
            station: 'complex',
            stationDistance: 100,
            stationScale: 3.0,
            moving: true,
            moveSpeed: 0.7,
            movePattern: 'orbit',
            obstacles: ['asteroids', 'satellites', 'astronaut'],
            asteroidCount: 15,
            satelliteCount: 4,
            fuel: 65,
            dockTolerance: 3.0,
            dockAlignTolerance: 0.35
        },
        {
            id: 10,
            name: "Master Pilot",
            station: 'mothership',
            stationDistance: 120,
            stationScale: 4.0,
            moving: true,
            moveSpeed: 1.0,
            movePattern: 'erratic',
            obstacles: ['asteroids', 'satellites', 'astronaut'],
            asteroidCount: 20,
            satelliteCount: 6,
            fuel: 55,
            dockTolerance: 2.5,
            dockAlignTolerance: 0.3
        }
    ];

    // Save data key
    const SAVE_KEY = 'spaceDockingGame';

    // Default save data
    const defaultSaveData = {
        unlockedLevel: 1,
        bestScores: {},
        settings: {
            mouseSensitivity: 1.0,
            invertY: false,
            invertForwardBack: false,
            invertStrafe: false,
            touchSensitivity: 1.0
        }
    };

    // Load save data from localStorage
    function loadSaveData() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                // Merge with defaults to ensure new settings exist
                return {
                    ...defaultSaveData,
                    ...data,
                    settings: { ...defaultSaveData.settings, ...data.settings }
                };
            }
        } catch (e) {
            console.warn('Failed to load save data:', e);
        }
        return { ...defaultSaveData };
    }

    // Save data to localStorage
    function saveSaveData(data) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save data:', e);
        }
    }

    // Get current save data
    let saveData = loadSaveData();

    // Public API
    return {
        getLevel(id) {
            return LEVELS.find(l => l.id === id) || LEVELS[0];
        },

        getAllLevels() {
            return LEVELS;
        },

        isLevelUnlocked(id) {
            return id <= saveData.unlockedLevel;
        },

        getUnlockedLevel() {
            return saveData.unlockedLevel;
        },

        unlockLevel(id) {
            if (id > saveData.unlockedLevel) {
                saveData.unlockedLevel = id;
                saveSaveData(saveData);
            }
        },

        getBestScore(levelId) {
            return saveData.bestScores[levelId] || null;
        },

        setBestScore(levelId, score) {
            const current = saveData.bestScores[levelId];
            if (!current || score.total > current.total) {
                saveData.bestScores[levelId] = score;
                saveSaveData(saveData);
                return true; // New best
            }
            return false;
        },

        calculateScore(levelId, timeSeconds, fuelRemaining) {
            const level = this.getLevel(levelId);

            // Base score from remaining fuel
            const fuelScore = Math.round(fuelRemaining * 10);

            // Time bonus (faster = more points, max 60 seconds for full bonus)
            const timeBonus = Math.max(0, Math.round((60 - timeSeconds) * 5));

            // Difficulty multiplier based on level
            const difficultyMultiplier = 1 + (levelId - 1) * 0.2;

            const total = Math.round((fuelScore + timeBonus) * difficultyMultiplier);

            return {
                fuel: fuelScore,
                time: timeBonus,
                multiplier: difficultyMultiplier,
                total: total
            };
        },

        getStars(levelId, score) {
            const level = this.getLevel(levelId);
            // Stars based on score thresholds
            const maxScore = 1000 * (1 + (levelId - 1) * 0.2);
            const ratio = score / maxScore;

            if (ratio >= 0.8) return 3;
            if (ratio >= 0.5) return 2;
            return 1;
        },

        getSettings() {
            return saveData.settings;
        },

        updateSettings(newSettings) {
            saveData.settings = { ...saveData.settings, ...newSettings };
            saveSaveData(saveData);
        },

        resetProgress() {
            saveData = { ...defaultSaveData };
            saveSaveData(saveData);
        }
    };
})();
