/**
 * Space Docking Game - Main Entry Point
 * Initializes Babylon.js scene and coordinates all game systems
 */

const SpaceDockingGame = (() => {
    // Babylon.js objects
    let canvas = null;
    let engine = null;
    let scene = null;
    let camera = null;

    // Background objects
    let backgroundPlanets = [];
    let distantStars = [];

    // Freeroam objects
    let freeroamObjects = [];
    let freeroamObstacles = []; // Collidable objects
    let freeroamPracticeStation = null;
    let explosionParticles = null;
    let isExploding = false;
    let respawnTimer = 0;

    // Game state
    let gameState = 'menu'; // menu, playing, paused, success, failure, freeroam
    let currentLevel = 1;
    let levelConfig = null;
    let gameTime = 0;
    let lastFrameTime = 0;
    let hintCooldown = 0;

    // Freeroam tracking
    let freeroamDistance = 0;
    let lastPlayerPos = null;

    // Initialize the game
    function init() {
        canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('Game canvas not found');
            return;
        }

        // Initialize Babylon.js engine
        engine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true
        });

        // Create scene
        createScene();

        // Initialize subsystems
        SpaceDockingPhysics.init(BABYLON);
        SpaceDockingControls.init(canvas);
        SpaceDockingUI.init();

        // Start render loop
        engine.runRenderLoop(render);

        // Handle window resize
        window.addEventListener('resize', resize);

        // Apply theme colors
        updateThemeColors();

        // Watch for theme changes
        const observer = new MutationObserver(updateThemeColors);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-city'] });

        console.log('Space Docking Game initialized');
    }

    // Create the 3D scene
    function createScene() {
        scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.03, 1);

        // Create camera
        camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 5, -15), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.minZ = 0.1;
        camera.maxZ = 5000;

        // Ambient light
        const ambientLight = new BABYLON.HemisphericLight(
            'ambient',
            new BABYLON.Vector3(0, 1, 0),
            scene
        );
        ambientLight.intensity = 0.4;
        ambientLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

        // Sun light
        const sunLight = new BABYLON.DirectionalLight(
            'sun',
            new BABYLON.Vector3(-0.5, -0.5, 0.5),
            scene
        );
        sunLight.intensity = 0.8;

        // Create enhanced starfield and background
        createStarfield();
        createBackgroundPlanets();

        // Create player
        SpaceDockingPlayer.create(scene, BABYLON);
    }

    // Create starfield background with multiple layers
    function createStarfield() {
        // Layer 1: Dense small stars
        const stars1 = new BABYLON.ParticleSystem('stars1', 3000, scene);
        stars1.particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAPUlEQVQYlWNgwA/+//8/gwFdgImBgYGBYfv27TDO/fv3Gf7//w9i/P//H8QAAILpDAi2AGIDGBgYGLA4AACLnQ0LTpqbIwAAAABJRU5ErkJggg==',
            scene
        );
        stars1.emitter = BABYLON.Vector3.Zero();
        stars1.createSphereEmitter(800);
        stars1.color1 = new BABYLON.Color4(1, 1, 1, 1);
        stars1.color2 = new BABYLON.Color4(0.9, 0.95, 1, 0.9);
        stars1.colorDead = new BABYLON.Color4(1, 1, 1, 0);
        stars1.minSize = 0.3;
        stars1.maxSize = 1.5;
        stars1.minLifeTime = 999999;
        stars1.maxLifeTime = 999999;
        stars1.emitRate = 3000;
        stars1.manualEmitCount = 3000;
        stars1.minEmitPower = 0;
        stars1.maxEmitPower = 0;
        stars1.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        stars1.start();
        setTimeout(() => stars1.emitRate = 0, 100);

        // Layer 2: Sparse bright stars
        const stars2 = new BABYLON.ParticleSystem('stars2', 500, scene);
        stars2.particleTexture = stars1.particleTexture;
        stars2.emitter = BABYLON.Vector3.Zero();
        stars2.createSphereEmitter(1200);
        stars2.color1 = new BABYLON.Color4(1, 1, 0.9, 1);
        stars2.color2 = new BABYLON.Color4(0.9, 0.9, 1, 1);
        stars2.colorDead = new BABYLON.Color4(1, 1, 1, 0);
        stars2.minSize = 1.5;
        stars2.maxSize = 3;
        stars2.minLifeTime = 999999;
        stars2.maxLifeTime = 999999;
        stars2.emitRate = 500;
        stars2.manualEmitCount = 500;
        stars2.minEmitPower = 0;
        stars2.maxEmitPower = 0;
        stars2.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        stars2.start();
        setTimeout(() => stars2.emitRate = 0, 100);

        distantStars = [stars1, stars2];
    }

    // Create background planets
    function createBackgroundPlanets() {
        backgroundPlanets = [];

        const planetConfigs = [
            { size: 150, distance: 1500, color: new BABYLON.Color3(0.8, 0.4, 0.2), rings: false },
            { size: 80, distance: 1200, color: new BABYLON.Color3(0.3, 0.5, 0.8), rings: false },
            { size: 200, distance: 2000, color: new BABYLON.Color3(0.9, 0.8, 0.5), rings: true },
            { size: 50, distance: 800, color: new BABYLON.Color3(0.6, 0.6, 0.7), rings: false },
            { size: 300, distance: 2500, color: new BABYLON.Color3(0.7, 0.3, 0.3), rings: false }
        ];

        planetConfigs.forEach((config, i) => {
            const angle = (i / planetConfigs.length) * Math.PI * 2 + Math.random();
            const elevation = (Math.random() - 0.5) * config.distance * 0.5;

            // Planet sphere
            const planet = BABYLON.MeshBuilder.CreateSphere('bgPlanet' + i, {
                diameter: config.size,
                segments: 32
            }, scene);

            planet.position = new BABYLON.Vector3(
                Math.cos(angle) * config.distance,
                elevation,
                Math.sin(angle) * config.distance
            );

            const planetMat = new BABYLON.StandardMaterial('planetMat' + i, scene);
            planetMat.diffuseColor = config.color;
            planetMat.emissiveColor = config.color.scale(0.1);
            planetMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            planet.material = planetMat;

            // Add rings to some planets
            if (config.rings) {
                const rings = BABYLON.MeshBuilder.CreateTorus('rings' + i, {
                    diameter: config.size * 2,
                    thickness: config.size * 0.1,
                    tessellation: 64
                }, scene);
                rings.parent = planet;
                rings.rotation.x = Math.PI / 4;

                const ringMat = new BABYLON.StandardMaterial('ringMat' + i, scene);
                ringMat.diffuseColor = config.color.scale(0.7);
                ringMat.alpha = 0.6;
                rings.material = ringMat;
            }

            backgroundPlanets.push(planet);
        });
    }

    // Main render loop
    function render() {
        if (!scene) return;

        const currentTime = performance.now();
        const deltaTime = lastFrameTime ? (currentTime - lastFrameTime) / 1000 : 0.016;
        lastFrameTime = currentTime;

        // Update based on game state
        if (gameState === 'playing') {
            update(deltaTime);
        } else if (gameState === 'freeroam') {
            updateFreeroam(deltaTime);
        }

        // Slowly rotate background planets
        backgroundPlanets.forEach((planet, i) => {
            planet.rotation.y += 0.0001 * (i + 1);
        });

        scene.render();
    }

    // Game update loop
    function update(deltaTime) {
        gameTime += deltaTime;
        hintCooldown = Math.max(0, hintCooldown - deltaTime);

        // Get input
        const input = SpaceDockingControls.getInput();

        // Handle hint (auto-align)
        if (input.hint && hintCooldown <= 0) {
            useHint();
            hintCooldown = 2; // 2 second cooldown
        }

        // Update player
        const fuelRemaining = SpaceDockingPlayer.update(input, deltaTime);

        // Update physics
        const physicsResult = SpaceDockingPhysics.update(
            SpaceDockingPlayer.mesh,
            SpaceDockingStations.dockingPort,
            levelConfig
        );

        // Update station
        const playerPos = SpaceDockingPlayer.mesh?.position;
        const stationPos = SpaceDockingStations.getDockingPortPosition();
        const distance = playerPos && stationPos ?
            BABYLON.Vector3.Distance(playerPos, stationPos) : Infinity;

        SpaceDockingStations.update(deltaTime, distance);

        // Update obstacles
        SpaceDockingObstacles.update(deltaTime);

        // Update camera to follow player
        updateCamera();

        // Check for collisions with obstacles
        const obstacles = SpaceDockingObstacles.getAllObstacles();
        if (SpaceDockingPhysics.checkCollisions(SpaceDockingPlayer.mesh, obstacles)) {
            handleFailure('Collision with obstacle!');
            return;
        }

        // Check for collision with station body
        if (SpaceDockingStations.checkCollision(SpaceDockingPlayer.mesh, BABYLON)) {
            handleFailure('Collision with station!');
            return;
        }

        // Check for success (docking complete)
        if (physicsResult.docked) {
            handleSuccess();
            return;
        }

        // Check for failure (out of fuel)
        if (fuelRemaining <= 0) {
            handleFailure('Out of fuel!');
            return;
        }

        // Update HUD
        const dockInfo = SpaceDockingPhysics.getDockingInfo(
            SpaceDockingPlayer.mesh,
            SpaceDockingStations.dockingPort
        );

        SpaceDockingUI.updateHUD({
            level: currentLevel,
            time: gameTime,
            fuel: SpaceDockingPlayer.getFuelPercent(),
            distance: dockInfo.distance,
            alignment: dockInfo.alignment,
            isDocking: dockInfo.isDocking
        });
    }

    // Freeroam update loop
    function updateFreeroam(deltaTime) {
        gameTime += deltaTime;

        // Handle respawn timer
        if (isExploding) {
            respawnTimer -= deltaTime;
            if (respawnTimer <= 0) {
                respawnPlayer();
            }
            // Update camera during explosion
            updateCamera();
            // Update freeroam objects
            freeroamObjects.forEach(obj => {
                if (obj.update) obj.update(deltaTime);
            });
            scene.render();
            return;
        }

        // Get input
        const input = SpaceDockingControls.getInput();

        // Update player (no fuel limit in freeroam)
        SpaceDockingPlayer.update(input, deltaTime);

        // Track distance traveled
        if (SpaceDockingPlayer.mesh) {
            const currentPos = SpaceDockingPlayer.mesh.position;
            if (lastPlayerPos) {
                freeroamDistance += BABYLON.Vector3.Distance(currentPos, lastPlayerPos);
            }
            lastPlayerPos = currentPos.clone();
        }

        // Update camera
        updateCamera();

        // Update freeroam objects
        freeroamObjects.forEach(obj => {
            if (obj.update) obj.update(deltaTime);
        });

        // Check for collisions with obstacles
        if (checkFreeroamCollision()) {
            triggerExplosion();
            return;
        }

        // Check for collision with practice station (if spawned)
        if (freeroamPracticeStation && SpaceDockingStations.checkCollision(SpaceDockingPlayer.mesh, BABYLON)) {
            triggerExplosion();
            return;
        }

        // Check for practice docking
        if (freeroamPracticeStation) {
            const dockPort = SpaceDockingStations.dockingPort;
            if (dockPort) {
                const physicsResult = SpaceDockingPhysics.update(
                    SpaceDockingPlayer.mesh,
                    dockPort,
                    { dockTolerance: 6.0, dockAlignTolerance: 0.5 }
                );

                if (physicsResult.docked) {
                    handlePracticeDockSuccess();
                }

                // Update station visuals
                const playerPos = SpaceDockingPlayer.mesh?.position;
                const stationPos = SpaceDockingStations.getDockingPortPosition();
                const distance = playerPos && stationPos ?
                    BABYLON.Vector3.Distance(playerPos, stationPos) : Infinity;
                SpaceDockingStations.update(deltaTime, distance);

                // Update HUD with docking info
                const dockInfo = SpaceDockingPhysics.getDockingInfo(
                    SpaceDockingPlayer.mesh,
                    dockPort
                );

                SpaceDockingUI.updateHUD({
                    level: 'Practice',
                    time: gameTime,
                    fuel: 100,
                    distance: dockInfo.distance,
                    alignment: dockInfo.alignment,
                    isDocking: dockInfo.isDocking
                });
                return;
            }
        }

        // Simple HUD update for freeroam
        SpaceDockingUI.updateHUD({
            level: 'Free',
            time: gameTime,
            fuel: 100, // Unlimited in freeroam
            distance: Infinity,
            alignment: 0,
            isDocking: false
        });
    }

    // Check collision with freeroam obstacles
    function checkFreeroamCollision() {
        if (!SpaceDockingPlayer.mesh) return false;

        for (const obstacle of freeroamObstacles) {
            if (!obstacle || obstacle.isDisposed?.()) continue;

            const distance = BABYLON.Vector3.Distance(
                SpaceDockingPlayer.mesh.position,
                obstacle.position
            );

            const obstacleRadius = obstacle.metadata?.collisionRadius || 5;
            const playerRadius = 3;

            if (distance < (playerRadius + obstacleRadius)) {
                return true;
            }
        }
        return false;
    }

    // Trigger explosion effect
    function triggerExplosion() {
        isExploding = true;
        respawnTimer = 2; // 2 seconds before respawn

        const playerPos = SpaceDockingPlayer.mesh.position.clone();

        // Hide player
        SpaceDockingPlayer.mesh.isVisible = false;

        // Create explosion particle system
        if (explosionParticles) {
            explosionParticles.dispose();
        }

        explosionParticles = new BABYLON.ParticleSystem('explosion', 500, scene);
        explosionParticles.particleTexture = new BABYLON.Texture(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABqklEQVRYhe2XsU7DMBCGv1RCLExMSEgsLKxsSIyMLOxsrEi8AC/AK/AKvAIjIwsbEgMTE0hMSJ0BqiLhOjlXYkLql6LEduz7c/87+y7GGGbZOrM8+r+AA3oREVJKZz3Ht7W/xZ5NKg4A7gE/PQS+OOjVAeBT4AngNnDuoJcHgLWLu8ApkDvoRQRwAPAUCID7DnotD/6VBsAl4Jm+P/ZWywOgGQG3gc9AfJMYMNIA6OV8Tw/4A2YAD/y1DABqANyucwC4kcvlXK0GAB1lLZdzyQFQLQKgbG5ZVssB+FRZwOVyAH6ukQfANxUA7ELkci7nJQC4VAJwr7kEwCVJWAu4VALwqQTgXgsAl8oA8KwEgHMlALcrATiXBCBgLwB3KgCYR8D9SgCuuARgqwzgRx4A3JcDwLdWALxQBsCZJAD7WgLwWBkA91YCsFYVAGeSAKyrAuBeLQBLqgJYlQPAWRKAw1oBuJAEYKkqgBNJAK6rBGCuJADn0v//HxEBzHcdOqDfATBT6e2OuuO+fW3p/2f6+Bm4u1zF1/+XtdbkBaCUmhsATu2i1moLwPnvG7h/bF/5CxPFvlMNIjlWAAAAAElFTkSuQmCC',
            scene
        );

        explosionParticles.emitter = playerPos;
        explosionParticles.minEmitBox = new BABYLON.Vector3(-1, -1, -1);
        explosionParticles.maxEmitBox = new BABYLON.Vector3(1, 1, 1);

        explosionParticles.color1 = new BABYLON.Color4(1, 0.6, 0, 1);
        explosionParticles.color2 = new BABYLON.Color4(1, 0.2, 0, 1);
        explosionParticles.colorDead = new BABYLON.Color4(0.2, 0.1, 0.1, 0);

        explosionParticles.minSize = 1;
        explosionParticles.maxSize = 4;

        explosionParticles.minLifeTime = 0.3;
        explosionParticles.maxLifeTime = 1.5;

        explosionParticles.emitRate = 500;
        explosionParticles.manualEmitCount = 300;

        explosionParticles.direction1 = new BABYLON.Vector3(-5, -5, -5);
        explosionParticles.direction2 = new BABYLON.Vector3(5, 5, 5);

        explosionParticles.minEmitPower = 10;
        explosionParticles.maxEmitPower = 30;

        explosionParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        explosionParticles.start();

        // Stop emitting after burst
        setTimeout(() => {
            if (explosionParticles) {
                explosionParticles.emitRate = 0;
            }
        }, 100);
    }

    // Respawn player after explosion
    function respawnPlayer() {
        isExploding = false;

        // Dispose explosion particles
        if (explosionParticles) {
            explosionParticles.dispose();
            explosionParticles = null;
        }

        // Show player
        SpaceDockingPlayer.mesh.isVisible = true;

        // Reset player position and velocity
        SpaceDockingPlayer.setPosition(
            new BABYLON.Vector3(0, 0, 0),
            new BABYLON.Vector3(0, 0, 0)
        );
        SpaceDockingPhysics.reset(BABYLON);

        // Reset camera
        if (camera) {
            camera.position = new BABYLON.Vector3(0, 5, -15);
        }
    }

    // Handle successful practice docking
    function handlePracticeDockSuccess() {
        // Remove practice station
        SpaceDockingStations.dispose();
        freeroamPracticeStation = null;

        // Show brief success message (could add particle effect here)
        console.log('Practice dock successful!');
    }

    // Spawn practice station in freeroam
    function spawnPracticeStation() {
        // Clean up existing practice station
        if (freeroamPracticeStation) {
            SpaceDockingStations.dispose();
        }

        // Pick a random station type
        const stationTypes = ['large', 'cruiser', 'carrier', 'battleship', 'mothership'];
        const randomType = stationTypes[Math.floor(Math.random() * stationTypes.length)];

        // Create practice config
        const practiceConfig = {
            station: randomType,
            stationDistance: 100 + Math.random() * 150,
            stationScale: 1.5 + Math.random() * 1.5,
            moving: false,
            moveSpeed: 0
        };

        // Create the station
        SpaceDockingStations.create(scene, BABYLON, randomType, practiceConfig);
        freeroamPracticeStation = true;

        // Show distance traveled notification
        const distanceKm = (freeroamDistance / 1000).toFixed(2);
        console.log(`Spawned practice station: ${randomType} | Distance traveled: ${distanceKm}km`);

        // Show distance in UI (temporary notification)
        showFreeroamNotification(`Station Spawned | Distance: ${Math.round(freeroamDistance)}m`);
    }

    // Show temporary notification in freeroam
    function showFreeroamNotification(message) {
        const existing = document.getElementById('freeroam-notification');
        if (existing) existing.remove();

        const notif = document.createElement('div');
        notif.id = 'freeroam-notification';
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: #00ff88;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            z-index: 1001;
            border: 1px solid #00ff88;
        `;
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(() => notif.remove(), 3000);
    }

    // Use hint to auto-align
    function useHint() {
        const dockPos = SpaceDockingStations.getDockingPortPosition();
        if (dockPos) {
            SpaceDockingPlayer.alignToTarget(dockPos);
        }
    }

    // Update camera to follow player
    function updateCamera() {
        if (!camera || !SpaceDockingPlayer.mesh) return;

        const player = SpaceDockingPlayer.mesh;

        // Camera offset behind and above player
        const offset = new BABYLON.Vector3(0, 3, -12);

        // Transform offset by player rotation
        const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
            player.rotation.y,
            player.rotation.x * 0.3,
            0
        );

        const worldOffset = BABYLON.Vector3.TransformCoordinates(offset, rotationMatrix);

        // Smooth camera follow
        const targetPosition = player.position.add(worldOffset);
        camera.position = BABYLON.Vector3.Lerp(camera.position, targetPosition, 0.1);

        // Look at player
        const lookTarget = player.position.add(new BABYLON.Vector3(0, 1, 0));
        camera.setTarget(lookTarget);
    }

    // Start a level
    function startLevel(levelId) {
        currentLevel = levelId;
        levelConfig = SpaceDockingLevels.getLevel(levelId);

        // Reset game state
        gameTime = 0;
        hintCooldown = 0;
        gameState = 'playing';

        // Clean up any freeroam objects
        disposeFreeroamObjects();

        // Reset player (disable infinite fuel for levels)
        SpaceDockingPlayer.setInfiniteFuel(false);
        SpaceDockingPlayer.reset(levelConfig.fuel);
        SpaceDockingPhysics.reset(BABYLON);

        // Position player at origin
        SpaceDockingPlayer.setPosition(
            new BABYLON.Vector3(0, 0, 0),
            new BABYLON.Vector3(0, 0, 0)
        );

        // Create station
        SpaceDockingStations.create(scene, BABYLON, levelConfig.station, levelConfig);

        // Create obstacles
        const stationPos = SpaceDockingStations.mesh?.position || new BABYLON.Vector3(50, 0, 0);
        SpaceDockingObstacles.create(scene, BABYLON, levelConfig, stationPos);

        // Reset camera
        if (camera) {
            camera.position = new BABYLON.Vector3(0, 5, -15);
        }

        // Show game screen
        SpaceDockingUI.showScreen('game-container');

        // Update initial HUD
        SpaceDockingUI.updateHUD({
            level: currentLevel,
            time: 0,
            fuel: 100,
            distance: Infinity,
            alignment: 0,
            isDocking: false
        });

        console.log(`Starting level ${levelId}: ${levelConfig.name}`);
    }

    // Start freeroam mode
    function startFreeroam() {
        gameState = 'freeroam';
        gameTime = 0;

        // Clean up level objects
        SpaceDockingStations.dispose();
        SpaceDockingObstacles.dispose();

        // Reset player with infinite fuel
        SpaceDockingPlayer.reset(100);
        SpaceDockingPlayer.setInfiniteFuel(true);
        SpaceDockingPhysics.reset(BABYLON);

        // Reset distance tracking
        freeroamDistance = 0;
        lastPlayerPos = null;

        // Position player at origin
        SpaceDockingPlayer.setPosition(
            new BABYLON.Vector3(0, 0, 0),
            new BABYLON.Vector3(0, 0, 0)
        );

        // Create freeroam environment
        createFreeroamEnvironment();

        // Reset camera
        if (camera) {
            camera.position = new BABYLON.Vector3(0, 5, -15);
        }

        // Show game screen
        SpaceDockingUI.showScreen('game-container');

        console.log('Starting freeroam mode');
    }

    // Create freeroam environment with lots of objects
    function createFreeroamEnvironment() {
        disposeFreeroamObjects();
        freeroamObjects = [];
        freeroamObstacles = [];
        freeroamPracticeStation = null;

        // Giant planets (closer and more impressive)
        const giantPlanets = [
            { size: 500, distance: 800, color: new BABYLON.Color3(0.9, 0.5, 0.2), speed: 0.0002 },
            { size: 800, distance: 1500, color: new BABYLON.Color3(0.7, 0.6, 0.4), speed: 0.0001, rings: true },
            { size: 300, distance: 600, color: new BABYLON.Color3(0.3, 0.6, 0.9), speed: 0.0003 },
            { size: 1200, distance: 2500, color: new BABYLON.Color3(0.8, 0.7, 0.5), speed: 0.00005, rings: true },
        ];

        giantPlanets.forEach((config, i) => {
            const angle = (i / giantPlanets.length) * Math.PI * 2;
            const planet = BABYLON.MeshBuilder.CreateSphere('freePlanet' + i, {
                diameter: config.size,
                segments: 48
            }, scene);

            planet.position = new BABYLON.Vector3(
                Math.cos(angle) * config.distance,
                (Math.random() - 0.5) * 400,
                Math.sin(angle) * config.distance
            );

            const mat = new BABYLON.StandardMaterial('freePlanetMat' + i, scene);
            mat.diffuseColor = config.color;
            mat.emissiveColor = config.color.scale(0.15);
            planet.material = mat;

            if (config.rings) {
                const rings = BABYLON.MeshBuilder.CreateTorus('freeRings' + i, {
                    diameter: config.size * 2.2,
                    thickness: config.size * 0.15,
                    tessellation: 64
                }, scene);
                rings.parent = planet;
                rings.rotation.x = Math.PI * 0.3;
                const ringMat = new BABYLON.StandardMaterial('freeRingMat' + i, scene);
                ringMat.diffuseColor = config.color.scale(0.5);
                ringMat.alpha = 0.7;
                rings.material = ringMat;
            }

            planet.metadata = { speed: config.speed, angle: angle, distance: config.distance, collisionRadius: config.size / 2 };
            planet.update = (dt) => {
                planet.metadata.angle += planet.metadata.speed;
                planet.position.x = Math.cos(planet.metadata.angle) * planet.metadata.distance;
                planet.position.z = Math.sin(planet.metadata.angle) * planet.metadata.distance;
                planet.rotation.y += 0.001;
            };

            freeroamObjects.push(planet);
            freeroamObstacles.push(planet); // Planets are solid/collidable
        });

        // Floating astronauts
        for (let i = 0; i < 5; i++) {
            const astro = createFreeroamAstronaut(i);
            freeroamObjects.push(astro);
        }

        // Satellites (collidable)
        for (let i = 0; i < 10; i++) {
            const sat = createFreeroamSatellite(i);
            freeroamObjects.push(sat);
            freeroamObstacles.push(sat);
        }

        // Other spacecraft (collidable)
        for (let i = 0; i < 5; i++) {
            const ship = createFreeroamSpacecraft(i);
            freeroamObjects.push(ship);
            freeroamObstacles.push(ship);
        }

        // Asteroid field (collidable)
        for (let i = 0; i < 50; i++) {
            const asteroid = createFreeroamAsteroid(i);
            freeroamObjects.push(asteroid);
            freeroamObstacles.push(asteroid); // Asteroids are collidable
        }

        // Debris field (collidable) - smaller rocks
        for (let i = 0; i < 30; i++) {
            const debris = createFreeroamDebris(i);
            freeroamObjects.push(debris);
            freeroamObstacles.push(debris);
        }
    }

    // Create freeroam astronaut
    function createFreeroamAstronaut(index) {
        const parts = [];

        const helmet = BABYLON.MeshBuilder.CreateSphere('freeHelmet' + index, { diameter: 1.2, segments: 16 }, scene);
        helmet.position.y = 1.5;
        parts.push(helmet);

        const torso = BABYLON.MeshBuilder.CreateBox('freeTorso' + index, { width: 1.2, height: 1.5, depth: 0.8 }, scene);
        torso.position.y = 0.5;
        parts.push(torso);

        const mesh = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);

        const distance = 100 + Math.random() * 300;
        const angle = Math.random() * Math.PI * 2;
        mesh.position = new BABYLON.Vector3(
            Math.cos(angle) * distance,
            (Math.random() - 0.5) * 100,
            Math.sin(angle) * distance
        );

        const mat = new BABYLON.StandardMaterial('freeAstroMat' + index, scene);
        mat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
        mesh.material = mat;

        mesh.metadata = {
            velocity: new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.5
            ),
            tumble: new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02
            )
        };

        mesh.update = (dt) => {
            mesh.position.addInPlace(mesh.metadata.velocity);
            mesh.rotation.addInPlace(mesh.metadata.tumble);
        };

        return mesh;
    }

    // Create freeroam satellite
    function createFreeroamSatellite(index) {
        const parts = [];

        const body = BABYLON.MeshBuilder.CreateBox('freeSatBody' + index, { width: 2, height: 2, depth: 3 }, scene);
        parts.push(body);

        const panel1 = BABYLON.MeshBuilder.CreateBox('freeSatPanel1' + index, { width: 8, height: 0.1, depth: 3 }, scene);
        panel1.position.x = 5;
        parts.push(panel1);

        const panel2 = BABYLON.MeshBuilder.CreateBox('freeSatPanel2' + index, { width: 8, height: 0.1, depth: 3 }, scene);
        panel2.position.x = -5;
        parts.push(panel2);

        const mesh = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);

        const orbitRadius = 150 + Math.random() * 200;
        const orbitSpeed = 0.001 + Math.random() * 0.002;
        const orbitOffset = Math.random() * Math.PI * 2;

        mesh.position = new BABYLON.Vector3(
            Math.cos(orbitOffset) * orbitRadius,
            (Math.random() - 0.5) * 80,
            Math.sin(orbitOffset) * orbitRadius
        );

        const mat = new BABYLON.StandardMaterial('freeSatMat' + index, scene);
        mat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.75);
        mesh.material = mat;

        mesh.metadata = { orbitRadius, orbitSpeed, angle: orbitOffset, collisionRadius: 8 };

        mesh.update = (dt) => {
            mesh.metadata.angle += mesh.metadata.orbitSpeed;
            mesh.position.x = Math.cos(mesh.metadata.angle) * mesh.metadata.orbitRadius;
            mesh.position.z = Math.sin(mesh.metadata.angle) * mesh.metadata.orbitRadius;
            mesh.rotation.y = -mesh.metadata.angle + Math.PI / 2;
        };

        return mesh;
    }

    // Create freeroam spacecraft
    function createFreeroamSpacecraft(index) {
        const parts = [];

        const body = BABYLON.MeshBuilder.CreateCylinder('freeShipBody' + index, { height: 8, diameter: 3 }, scene);
        body.rotation.x = Math.PI / 2;
        parts.push(body);

        const cockpit = BABYLON.MeshBuilder.CreateSphere('freeShipCockpit' + index, { diameter: 2 }, scene);
        cockpit.position.z = 4;
        parts.push(cockpit);

        const mesh = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);

        const distance = 80 + Math.random() * 250;
        const angle = Math.random() * Math.PI * 2;
        mesh.position = new BABYLON.Vector3(
            Math.cos(angle) * distance,
            (Math.random() - 0.5) * 60,
            Math.sin(angle) * distance
        );

        const mat = new BABYLON.StandardMaterial('freeShipMat' + index, scene);
        mat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.85);
        mat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.06);
        mesh.material = mat;

        mesh.metadata = {
            velocity: new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.3
            ),
            collisionRadius: 5
        };

        mesh.update = (dt) => {
            mesh.position.addInPlace(mesh.metadata.velocity);
        };

        return mesh;
    }

    // Create freeroam asteroid
    function createFreeroamAsteroid(index) {
        const baseRadius = 2 + Math.random() * 8;
        const asteroid = BABYLON.MeshBuilder.CreateIcoSphere('freeAsteroid' + index, {
            radius: baseRadius,
            subdivisions: 2,
            flat: true
        }, scene);

        // Deform for irregular shape
        const positions = asteroid.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) {
            const noise = 0.6 + Math.random() * 0.8;
            positions[i] *= noise;
            positions[i + 1] *= noise;
            positions[i + 2] *= noise;
        }
        asteroid.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

        const distance = 50 + Math.random() * 400;
        const angle = Math.random() * Math.PI * 2;
        asteroid.position = new BABYLON.Vector3(
            Math.cos(angle) * distance,
            (Math.random() - 0.5) * 150,
            Math.sin(angle) * distance
        );

        const mat = new BABYLON.StandardMaterial('freeAsteroidMat' + index, scene);
        mat.diffuseColor = new BABYLON.Color3(0.35, 0.3, 0.25);
        asteroid.material = mat;

        asteroid.metadata = {
            collisionRadius: baseRadius * 0.8, // Collision radius
            rotSpeed: new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01
            )
        };

        asteroid.update = (dt) => {
            asteroid.rotation.addInPlace(asteroid.metadata.rotSpeed);
        };

        return asteroid;
    }

    // Create freeroam debris (smaller collidable rocks)
    function createFreeroamDebris(index) {
        const baseRadius = 1 + Math.random() * 3;
        const debris = BABYLON.MeshBuilder.CreateIcoSphere('freeDebris' + index, {
            radius: baseRadius,
            subdivisions: 1,
            flat: true
        }, scene);

        // Deform for irregular shape
        const positions = debris.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) {
            const noise = 0.5 + Math.random() * 1;
            positions[i] *= noise;
            positions[i + 1] *= noise;
            positions[i + 2] *= noise;
        }
        debris.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

        const distance = 30 + Math.random() * 300;
        const angle = Math.random() * Math.PI * 2;
        debris.position = new BABYLON.Vector3(
            Math.cos(angle) * distance,
            (Math.random() - 0.5) * 100,
            Math.sin(angle) * distance
        );

        const mat = new BABYLON.StandardMaterial('freeDebrisMat' + index, scene);
        mat.diffuseColor = new BABYLON.Color3(0.4, 0.35, 0.3);
        debris.material = mat;

        const velocity = new BABYLON.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.2
        );

        debris.metadata = {
            collisionRadius: baseRadius * 0.7,
            velocity: velocity,
            rotSpeed: new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.03
            )
        };

        debris.update = (dt) => {
            debris.position.addInPlace(debris.metadata.velocity);
            debris.rotation.addInPlace(debris.metadata.rotSpeed);
        };

        return debris;
    }

    // Dispose freeroam objects
    function disposeFreeroamObjects() {
        freeroamObjects.forEach(obj => {
            if (obj.dispose) obj.dispose();
        });
        freeroamObjects = [];
    }

    // Handle successful docking
    function handleSuccess() {
        gameState = 'success';

        // Calculate score
        const fuelRemaining = SpaceDockingPlayer.getFuelPercent();
        const score = SpaceDockingLevels.calculateScore(currentLevel, gameTime, fuelRemaining);

        // Save score and unlock next level
        const isNewBest = SpaceDockingLevels.setBestScore(currentLevel, score);

        if (currentLevel < 10) {
            SpaceDockingLevels.unlockLevel(currentLevel + 1);
        }

        // Release pointer lock
        SpaceDockingControls.releasePointerLock();

        // Show success screen
        SpaceDockingUI.showSuccess(currentLevel, gameTime, fuelRemaining, score, isNewBest);
    }

    // Handle failure
    function handleFailure(reason) {
        gameState = 'failure';

        // Release pointer lock
        SpaceDockingControls.releasePointerLock();

        // Show failure screen
        SpaceDockingUI.showFailure(reason);
    }

    // Toggle pause
    function togglePause() {
        if (gameState === 'playing' || gameState === 'freeroam') {
            gameState = 'paused';
            SpaceDockingControls.releasePointerLock();
            SpaceDockingUI.showPause();
        } else if (gameState === 'paused') {
            resume();
        }
    }

    // Resume from pause
    function resume() {
        if (gameState === 'paused') {
            gameState = levelConfig ? 'playing' : 'freeroam';
            SpaceDockingUI.hidePause();
        }
    }

    // Restart current level
    function restartLevel() {
        if (levelConfig) {
            startLevel(currentLevel);
        } else {
            startFreeroam();
        }
    }

    // Go to next level
    function nextLevel() {
        if (currentLevel < 10) {
            startLevel(currentLevel + 1);
        }
    }

    // Quit to menu
    function quitToMenu() {
        gameState = 'menu';
        levelConfig = null;

        // Clean up
        SpaceDockingStations.dispose();
        SpaceDockingObstacles.dispose();
        disposeFreeroamObjects();
        SpaceDockingControls.releasePointerLock();
        SpaceDockingControls.reset();

        // Reset player position
        if (SpaceDockingPlayer.mesh) {
            SpaceDockingPlayer.mesh.position = new BABYLON.Vector3(0, 0, 0);
        }

        SpaceDockingUI.showScreen('level-select');
    }

    // Handle window resize
    function resize() {
        if (engine) {
            engine.resize();
        }
    }

    // Update theme colors from CSS
    function updateThemeColors() {
        const themeColor = SpaceDockingUI.getThemeColor();
        SpaceDockingPlayer.setThrusterColor(themeColor);
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

    // Public API
    return {
        startLevel,
        startFreeroam,
        spawnPracticeStation,
        togglePause,
        resume,
        restartLevel,
        nextLevel,
        quitToMenu,
        resize,
        useHint,
        get gameState() { return gameState; },
        get currentLevel() { return currentLevel; },
        get scene() { return scene; },
        get BABYLON() { return BABYLON; },
        getScene: () => scene,
        getBABYLON: () => BABYLON
    };
})();

// Make globally accessible
window.SpaceDockingGame = SpaceDockingGame;
