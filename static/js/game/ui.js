/**
 * Space Docking Game - UI System
 * Handles HUD, menus, and screen management
 */

const SpaceDockingUI = (() => {
    // DOM elements
    let elements = {};

    // Current state
    let currentScreen = 'level-select';

    // Initialize UI
    function init() {
        // Cache DOM elements
        elements = {
            // Screens
            levelSelect: document.getElementById('level-select'),
            gameContainer: document.getElementById('game-container'),
            pauseMenu: document.getElementById('pause-menu'),
            successScreen: document.getElementById('success-screen'),
            failureScreen: document.getElementById('failure-screen'),
            settingsPanel: document.getElementById('settings-panel'),
            customizationPanel: document.getElementById('customization-panel'),

            // Level grid
            levelGrid: document.getElementById('level-grid'),

            // HUD elements
            hudLevelNum: document.getElementById('hud-level-num'),
            hudTime: document.getElementById('hud-time'),
            fuelBar: document.getElementById('fuel-bar'),
            fuelPercent: document.getElementById('fuel-percent'),
            proximityValue: document.getElementById('proximity-value'),
            alignmentBar: document.getElementById('alignment-bar'),

            // Buttons
            pauseBtn: document.getElementById('pause-btn'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),
            resumeBtn: document.getElementById('resume-btn'),
            restartBtn: document.getElementById('restart-btn'),
            quitBtn: document.getElementById('quit-btn'),
            nextLevelBtn: document.getElementById('next-level-btn'),
            replayBtn: document.getElementById('replay-btn'),
            successMenuBtn: document.getElementById('success-menu-btn'),
            retryBtn: document.getElementById('retry-btn'),
            failureMenuBtn: document.getElementById('failure-menu-btn'),
            freeroamBtn: document.getElementById('freeroam-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsCloseBtn: document.getElementById('settings-close-btn'),
            resetProgressBtn: document.getElementById('reset-progress-btn'),
            hintBtn: document.getElementById('hint-btn'),
            spawnStationBtn: document.getElementById('spawn-station-btn'),
            customizeBtn: document.getElementById('customize-btn'),
            customizationCloseBtn: document.getElementById('customization-close-btn'),
            controlsPanel: document.getElementById('controls-panel'),
            controlsCloseBtn: document.getElementById('controls-close-btn'),
            controlsBtn: document.getElementById('controls-btn'),

            // Settings inputs
            invertY: document.getElementById('invert-y'),
            invertWS: document.getElementById('invert-ws'),
            invertAD: document.getElementById('invert-ad'),
            mouseSens: document.getElementById('mouse-sens'),
            mouseSensValue: document.getElementById('mouse-sens-value'),

            // Success stats
            successTime: document.getElementById('success-time'),
            successFuel: document.getElementById('success-fuel'),
            successScore: document.getElementById('success-score'),
            newBest: document.getElementById('new-best'),

            // Failure
            failureReason: document.getElementById('failure-reason'),

            // Docking indicator
            dockingIndicator: document.getElementById('docking-indicator'),

            // Touch controls
            touchControls: document.getElementById('touch-controls')
        };

        // Build level grid
        buildLevelGrid();

        // Setup button handlers
        setupButtons();

        // Setup settings panel
        setupSettings();

        // Check for touch device
        if (SpaceDockingControls.isTouchDevice()) {
            elements.touchControls?.classList.add('visible');
        }
    }

    // Build level selection grid
    function buildLevelGrid() {
        if (!elements.levelGrid) return;

        elements.levelGrid.innerHTML = '';

        const levels = SpaceDockingLevels.getAllLevels();
        const unlockedLevel = SpaceDockingLevels.getUnlockedLevel();

        levels.forEach(level => {
            const btn = document.createElement('button');
            btn.className = 'level-btn';

            const isUnlocked = level.id <= unlockedLevel;
            const bestScore = SpaceDockingLevels.getBestScore(level.id);

            if (!isUnlocked) {
                btn.classList.add('locked');
            } else if (bestScore) {
                btn.classList.add('completed');
            }

            // Level number
            const numSpan = document.createElement('span');
            numSpan.className = 'level-num';
            numSpan.textContent = level.id;
            btn.appendChild(numSpan);

            // Stars (if completed)
            if (bestScore) {
                const stars = SpaceDockingLevels.getStars(level.id, bestScore.total);
                const starsDiv = document.createElement('div');
                starsDiv.className = 'level-stars';

                for (let i = 0; i < 3; i++) {
                    const star = document.createElement('i');
                    star.className = i < stars ? 'fas fa-star filled' : 'far fa-star';
                    starsDiv.appendChild(star);
                }

                btn.appendChild(starsDiv);
            }

            // Click handler
            if (isUnlocked) {
                btn.addEventListener('click', () => {
                    if (window.SpaceDockingGame) {
                        window.SpaceDockingGame.startLevel(level.id);
                    }
                });
            }

            // Tooltip with level name
            btn.title = level.name;

            elements.levelGrid.appendChild(btn);
        });
    }

    // Setup button event handlers
    function setupButtons() {
        // Pause button
        elements.pauseBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.togglePause();
            }
        });

        // Fullscreen button
        elements.fullscreenBtn?.addEventListener('click', toggleFullscreen);

        // Resume button
        elements.resumeBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.resume();
            }
        });

        // Restart button
        elements.restartBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.restartLevel();
            }
        });

        // Quit button
        elements.quitBtn?.addEventListener('click', () => {
            showScreen('level-select');
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.quitToMenu();
            }
        });

        // Next level button
        elements.nextLevelBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.nextLevel();
            }
        });

        // Replay button
        elements.replayBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.restartLevel();
            }
        });

        // Success menu button
        elements.successMenuBtn?.addEventListener('click', () => {
            showScreen('level-select');
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.quitToMenu();
            }
        });

        // Retry button
        elements.retryBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.restartLevel();
            }
        });

        // Failure menu button
        elements.failureMenuBtn?.addEventListener('click', () => {
            showScreen('level-select');
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.quitToMenu();
            }
        });

        // Freeroam button
        elements.freeroamBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.startFreeroam();
            }
        });

        // Settings button
        elements.settingsBtn?.addEventListener('click', () => {
            showScreen('settings-panel');
        });

        // Settings close button
        elements.settingsCloseBtn?.addEventListener('click', () => {
            showScreen('level-select');
        });

        // Reset progress button
        elements.resetProgressBtn?.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
                SpaceDockingLevels.resetProgress();
                buildLevelGrid();
            }
        });

        // Hint button
        elements.hintBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.useHint();
            }
        });

        // Spawn station button (freeroam mode)
        elements.spawnStationBtn?.addEventListener('click', () => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.spawnPracticeStation();
            }
        });

        // Customize button
        elements.customizeBtn?.addEventListener('click', () => {
            showScreen('customization-panel');
            updateCustomizationUI();
        });

        // Customization close button
        elements.customizationCloseBtn?.addEventListener('click', () => {
            showScreen('level-select');
        });

        // Ship type buttons
        document.querySelectorAll('.ship-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const shipType = btn.dataset.ship;
                if (shipType && window.SpaceDockingPlayer) {
                    window.SpaceDockingPlayer.setShipType(
                        window.SpaceDockingGame?.getScene(),
                        window.SpaceDockingGame?.getBABYLON(),
                        shipType
                    );
                    updateCustomizationUI();
                }
            });
        });

        // Ship color buttons
        document.querySelectorAll('.ship-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const colorStr = btn.dataset.color;
                if (colorStr && window.SpaceDockingPlayer) {
                    const [r, g, b] = colorStr.split(',').map(Number);
                    window.SpaceDockingPlayer.setShipColor({ r, g, b });
                    updateCustomizationUI();
                }
            });
        });

        // Thruster color buttons
        document.querySelectorAll('.thruster-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const colorStr = btn.dataset.color;
                if (colorStr && window.SpaceDockingPlayer) {
                    const [r, g, b] = colorStr.split(',').map(Number);
                    window.SpaceDockingPlayer.setBoostColor({ r, g, b });
                    updateCustomizationUI();
                }
            });
        });

        // Controls close button
        elements.controlsCloseBtn?.addEventListener('click', () => {
            hideControls();
        });

        // Controls HUD button
        elements.controlsBtn?.addEventListener('click', () => {
            showControls();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key - pause/resume/close menus
            if (e.code === 'Escape') {
                if (currentScreen === 'controls-panel') {
                    hideControls();
                } else if (currentScreen === 'game-container') {
                    if (window.SpaceDockingGame) {
                        window.SpaceDockingGame.togglePause();
                    }
                } else if (currentScreen === 'pause-menu') {
                    if (window.SpaceDockingGame) {
                        window.SpaceDockingGame.resume();
                    }
                }
            }

            // ? or / key - show controls help (Shift+/ = ?)
            if ((e.key === '?' || (e.code === 'Slash' && e.shiftKey))) {
                e.preventDefault();
                if (currentScreen === 'controls-panel') {
                    hideControls();
                } else if (currentScreen === 'game-container' || currentScreen === 'pause-menu') {
                    showControls();
                }
            }

            // R key - restart level (only in pause, success, or failure screens)
            if (e.code === 'KeyR' && !e.ctrlKey && !e.altKey) {
                if (currentScreen === 'pause-menu' || currentScreen === 'success-screen' || currentScreen === 'failure-screen') {
                    e.preventDefault();
                    if (window.SpaceDockingGame) {
                        window.SpaceDockingGame.restartLevel();
                    }
                }
            }

            // N key - next level (only in success screen)
            if (e.code === 'KeyN' && !e.ctrlKey && !e.altKey) {
                if (currentScreen === 'success-screen') {
                    e.preventDefault();
                    if (window.SpaceDockingGame) {
                        window.SpaceDockingGame.nextLevel();
                    }
                }
            }

            // M key - return to menu (in any gameplay-related screen)
            if (e.code === 'KeyM' && !e.ctrlKey && !e.altKey) {
                if (currentScreen === 'pause-menu' || currentScreen === 'success-screen' ||
                    currentScreen === 'failure-screen' || currentScreen === 'controls-panel') {
                    e.preventDefault();
                    if (window.SpaceDockingGame) {
                        window.SpaceDockingGame.quitToMenu();
                    }
                }
            }

            // P key - spawn practice station (freeroam only)
            if (e.code === 'KeyP' && !e.ctrlKey && !e.altKey) {
                if (currentScreen === 'game-container' && window.SpaceDockingGame?.gameState === 'freeroam') {
                    e.preventDefault();
                    window.SpaceDockingGame.spawnPracticeStation();
                }
            }

            // F key - toggle fullscreen (during gameplay)
            if (e.code === 'KeyF' && !e.ctrlKey && !e.altKey) {
                if (currentScreen === 'game-container') {
                    e.preventDefault();
                    toggleFullscreen();
                }
            }

            // Menu navigation hotkeys (only on level-select screen)
            if (currentScreen === 'level-select') {
                // Number keys 1-9, 0 (for level 10) to start levels
                const levelKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
                                   'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
                const keyIndex = levelKeys.indexOf(e.code);
                if (keyIndex !== -1 && !e.ctrlKey && !e.altKey) {
                    const levelId = keyIndex === 9 ? 10 : keyIndex + 1;
                    const unlockedLevel = SpaceDockingLevels.getUnlockedLevel();
                    if (levelId <= unlockedLevel) {
                        e.preventDefault();
                        window.SpaceDockingGame?.startLevel(levelId);
                    }
                }

                // S key - Settings
                if (e.code === 'KeyS' && !e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    showScreen('settings-panel');
                }

                // C key - Customize
                if (e.code === 'KeyC' && !e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    showScreen('customization-panel');
                    updateCustomizationUI();
                }

                // G key - Freeroam (Go explore)
                if (e.code === 'KeyG' && !e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    window.SpaceDockingGame?.startFreeroam();
                }
            }

            // Settings/Customization panel - Escape or Backspace to close
            if (currentScreen === 'settings-panel' || currentScreen === 'customization-panel') {
                if (e.code === 'Escape' || e.code === 'Backspace') {
                    e.preventDefault();
                    showScreen('level-select');
                }
            }
        });
    }

    // Show controls help panel
    function showControls() {
        // Release pointer lock to show cursor
        if (window.SpaceDockingControls) {
            window.SpaceDockingControls.releasePointerLock();
        }
        showScreen('controls-panel');
    }

    // Hide controls help panel - return to appropriate screen
    function hideControls() {
        const gameState = window.SpaceDockingGame?.gameState;
        if (gameState === 'paused') {
            showScreen('pause-menu');
        } else if (gameState === 'playing' || gameState === 'freeroam') {
            showScreen('game-container');
        } else {
            showScreen('level-select');
        }
    }

    // Setup settings panel
    function setupSettings() {
        // Load saved settings
        const settings = SpaceDockingLevels.getSettings();

        // Initialize toggle states
        if (elements.invertY) {
            elements.invertY.checked = settings.invertY || false;
            elements.invertY.addEventListener('change', (e) => {
                SpaceDockingControls.updateSettings({ invertY: e.target.checked });
            });
        }

        if (elements.invertWS) {
            elements.invertWS.checked = settings.invertForwardBack || false;
            elements.invertWS.addEventListener('change', (e) => {
                SpaceDockingControls.updateSettings({ invertForwardBack: e.target.checked });
            });
        }

        if (elements.invertAD) {
            elements.invertAD.checked = settings.invertStrafe || false;
            elements.invertAD.addEventListener('change', (e) => {
                SpaceDockingControls.updateSettings({ invertStrafe: e.target.checked });
            });
        }

        if (elements.mouseSens) {
            elements.mouseSens.value = settings.mouseSensitivity || 1.0;
            if (elements.mouseSensValue) {
                elements.mouseSensValue.textContent = parseFloat(elements.mouseSens.value).toFixed(1);
            }
            elements.mouseSens.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (elements.mouseSensValue) {
                    elements.mouseSensValue.textContent = value.toFixed(1);
                }
                SpaceDockingControls.updateSettings({ mouseSensitivity: value });
            });
        }
    }

    // Update customization UI to reflect current selections
    function updateCustomizationUI() {
        if (!window.SpaceDockingPlayer) return;

        const currentShip = window.SpaceDockingPlayer.currentShipType;
        const currentColor = window.SpaceDockingPlayer.currentShipColor;
        const currentBoost = window.SpaceDockingPlayer.currentBoostColor;

        // Update ship type buttons
        document.querySelectorAll('.ship-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.ship === currentShip);
        });

        // Update ship color buttons
        document.querySelectorAll('.ship-color-btn').forEach(btn => {
            const [r, g, b] = btn.dataset.color.split(',').map(Number);
            const isSelected = Math.abs(r - currentColor.r) < 0.01 &&
                               Math.abs(g - currentColor.g) < 0.01 &&
                               Math.abs(b - currentColor.b) < 0.01;
            btn.classList.toggle('selected', isSelected);
        });

        // Update thruster color buttons
        document.querySelectorAll('.thruster-color-btn').forEach(btn => {
            const [r, g, b] = btn.dataset.color.split(',').map(Number);
            const isSelected = Math.abs(r - currentBoost.r) < 0.01 &&
                               Math.abs(g - currentBoost.g) < 0.01 &&
                               Math.abs(b - currentBoost.b) < 0.01;
            btn.classList.toggle('selected', isSelected);
        });
    }

    // Toggle fullscreen
    function toggleFullscreen() {
        const container = elements.gameContainer;
        if (!container) return;

        if (container.classList.contains('fullscreen')) {
            container.classList.remove('fullscreen');
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            elements.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        } else {
            container.classList.add('fullscreen');
            if (container.requestFullscreen) {
                container.requestFullscreen().catch(() => {});
            }
            elements.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        }

        // Resize canvas after fullscreen change
        setTimeout(() => {
            if (window.SpaceDockingGame) {
                window.SpaceDockingGame.resize();
            }
        }, 100);
    }

    // Show a specific screen
    function showScreen(screenId) {
        // Hide all screens
        const screens = ['level-select', 'game-container', 'pause-menu', 'success-screen', 'failure-screen', 'settings-panel', 'customization-panel', 'controls-panel'];

        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active');
            }
        });

        // Show requested screen
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
        }

        currentScreen = screenId;

        // Refresh level grid when returning to menu
        if (screenId === 'level-select') {
            buildLevelGrid();
        }
    }

    // Update HUD
    function updateHUD(data) {
        // Level number
        if (elements.hudLevelNum && data.level !== undefined) {
            elements.hudLevelNum.textContent = data.level;
        }

        // Time
        if (elements.hudTime && data.time !== undefined) {
            const minutes = Math.floor(data.time / 60);
            const seconds = Math.floor(data.time % 60);
            elements.hudTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        // Fuel
        if (data.fuel !== undefined) {
            if (elements.fuelBar) {
                elements.fuelBar.style.width = `${data.fuel}%`;
                elements.fuelBar.classList.toggle('low', data.fuel < 25);
            }
            if (elements.fuelPercent) {
                elements.fuelPercent.textContent = `${Math.round(data.fuel)}%`;
            }
        }

        // Proximity
        if (elements.proximityValue && data.distance !== undefined) {
            const dist = Math.round(data.distance);
            elements.proximityValue.textContent = dist < 1000 ? `${dist}m` : '--';
            elements.proximityValue.classList.toggle('close', dist < 20);
        }

        // Alignment
        if (elements.alignmentBar && data.alignment !== undefined) {
            const alignPercent = Math.round(data.alignment * 100);
            elements.alignmentBar.style.width = `${alignPercent}%`;
            elements.alignmentBar.classList.toggle('aligned', alignPercent > 80);
        }

        // Docking indicator
        if (elements.dockingIndicator) {
            elements.dockingIndicator.classList.toggle('hidden', !data.isDocking);
        }

        // Show spawn station button only in freeroam mode
        if (elements.spawnStationBtn) {
            const isFreeroam = data.level === 'Free' || data.level === 'Practice';
            elements.spawnStationBtn.style.display = isFreeroam ? 'flex' : 'none';
        }
    }

    // Show success screen
    function showSuccess(levelId, timeSeconds, fuelRemaining, score, isNewBest) {
        // Update stats
        if (elements.successTime) {
            const minutes = Math.floor(timeSeconds / 60);
            const seconds = Math.floor(timeSeconds % 60);
            elements.successTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (elements.successFuel) {
            elements.successFuel.textContent = `${Math.round(fuelRemaining)}%`;
        }

        if (elements.successScore) {
            elements.successScore.textContent = score.total;
        }

        if (elements.newBest) {
            elements.newBest.classList.toggle('hidden', !isNewBest);
        }

        // Hide next level button if this is level 10
        if (elements.nextLevelBtn) {
            elements.nextLevelBtn.style.display = levelId >= 10 ? 'none' : 'block';
        }

        showScreen('success-screen');
    }

    // Show failure screen
    function showFailure(reason) {
        if (elements.failureReason) {
            elements.failureReason.textContent = reason;
        }

        showScreen('failure-screen');
    }

    // Show pause menu
    function showPause() {
        showScreen('pause-menu');
    }

    // Hide pause menu and return to game
    function hidePause() {
        showScreen('game-container');
    }

    // Get theme color from CSS
    function getThemeColor() {
        const style = getComputedStyle(document.documentElement);
        const primary = style.getPropertyValue('--primary').trim();

        // Parse hex color
        if (primary.startsWith('#')) {
            const hex = primary.slice(1);
            return {
                r: parseInt(hex.substr(0, 2), 16) / 255,
                g: parseInt(hex.substr(2, 2), 16) / 255,
                b: parseInt(hex.substr(4, 2), 16) / 255
            };
        }

        // Default to orange
        return { r: 1, g: 0.4, b: 0 };
    }

    return {
        init,
        showScreen,
        updateHUD,
        showSuccess,
        showFailure,
        showPause,
        hidePause,
        buildLevelGrid,
        getThemeColor,
        get currentScreen() { return currentScreen; }
    };
})();
