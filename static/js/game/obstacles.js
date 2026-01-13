/**
 * Space Docking Game - Obstacles
 * Creates asteroids, satellites, and astronaut hazards
 */

const SpaceDockingObstacles = (() => {
    // Obstacle arrays
    let asteroids = [];
    let satellites = [];
    let astronaut = null;

    // Movement state
    let obstacleTime = 0;

    // Create all obstacles for a level
    function create(scene, BABYLON, levelConfig, stationPosition) {
        dispose();
        obstacleTime = 0;

        const obstacles = levelConfig.obstacles || [];

        if (obstacles.includes('asteroids') || obstacles.includes('all')) {
            createAsteroids(scene, BABYLON, levelConfig, stationPosition);
        }

        if (obstacles.includes('satellites') || obstacles.includes('all')) {
            createSatellites(scene, BABYLON, levelConfig, stationPosition);
        }

        if (obstacles.includes('astronaut') || obstacles.includes('all')) {
            createAstronaut(scene, BABYLON, stationPosition);
        }
    }

    // Create asteroids
    function createAsteroids(scene, BABYLON, levelConfig, stationPosition) {
        const count = levelConfig.asteroidCount || 10;

        for (let i = 0; i < count; i++) {
            // Create irregular asteroid shape
            const asteroid = createAsteroidMesh(scene, BABYLON);

            // Random size
            const scale = 1 + Math.random() * 3;
            asteroid.scaling = new BABYLON.Vector3(scale, scale * (0.7 + Math.random() * 0.6), scale);

            // Position between player start and station
            // Create a field around the path to the station
            const t = 0.2 + Math.random() * 0.6; // 20-80% of the way
            const pathPoint = stationPosition.scale(t);

            // Offset from direct path
            const offset = new BABYLON.Vector3(
                (Math.random() - 0.5) * 60,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 60
            );

            asteroid.position = pathPoint.add(offset);

            // Random rotation
            asteroid.rotation = new BABYLON.Vector3(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Store rotation speed for animation
            asteroid.metadata = {
                rotationSpeed: new BABYLON.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                ),
                collisionRadius: scale * 1.5
            };

            // Material
            const asteroidMat = new BABYLON.StandardMaterial('asteroidMat' + i, scene);
            asteroidMat.diffuseColor = new BABYLON.Color3(
                0.3 + Math.random() * 0.2,
                0.25 + Math.random() * 0.15,
                0.2 + Math.random() * 0.1
            );
            asteroidMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            asteroid.material = asteroidMat;

            asteroids.push(asteroid);
        }
    }

    // Create a single asteroid mesh (irregular shape)
    function createAsteroidMesh(scene, BABYLON) {
        // Start with icosphere and deform it
        const asteroid = BABYLON.MeshBuilder.CreateIcoSphere('asteroid', {
            radius: 1,
            subdivisions: 2,
            flat: true
        }, scene);

        // Deform vertices for irregular shape
        const positions = asteroid.getVerticesData(BABYLON.VertexBuffer.PositionKind);

        for (let i = 0; i < positions.length; i += 3) {
            const noise = 0.7 + Math.random() * 0.6;
            positions[i] *= noise;
            positions[i + 1] *= noise;
            positions[i + 2] *= noise;
        }

        asteroid.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        asteroid.refreshBoundingInfo();

        return asteroid;
    }

    // Create satellites
    function createSatellites(scene, BABYLON, levelConfig, stationPosition) {
        const count = levelConfig.satelliteCount || 4;

        for (let i = 0; i < count; i++) {
            const satellite = createSatelliteMesh(scene, BABYLON);

            // Position in orbit around the play area
            const orbitRadius = 30 + Math.random() * 40;
            const orbitAngle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const orbitHeight = (Math.random() - 0.5) * 30;

            satellite.position = new BABYLON.Vector3(
                Math.cos(orbitAngle) * orbitRadius,
                orbitHeight,
                Math.sin(orbitAngle) * orbitRadius
            );

            // Store orbit parameters
            satellite.metadata = {
                orbitRadius: orbitRadius,
                orbitSpeed: 0.2 + Math.random() * 0.3,
                orbitOffset: orbitAngle,
                orbitHeight: orbitHeight,
                collisionRadius: 3
            };

            satellites.push(satellite);
        }
    }

    // Create a satellite mesh
    function createSatelliteMesh(scene, BABYLON) {
        const parts = [];

        // Main body (box)
        const body = BABYLON.MeshBuilder.CreateBox('satBody', {
            width: 1.5,
            height: 1.5,
            depth: 2
        }, scene);
        parts.push(body);

        // Solar panels
        const panelLeft = BABYLON.MeshBuilder.CreateBox('panelLeft', {
            width: 4,
            height: 0.1,
            depth: 1.5
        }, scene);
        panelLeft.position.x = -3;
        parts.push(panelLeft);

        const panelRight = BABYLON.MeshBuilder.CreateBox('panelRight', {
            width: 4,
            height: 0.1,
            depth: 1.5
        }, scene);
        panelRight.position.x = 3;
        parts.push(panelRight);

        // Antenna dish
        const dish = BABYLON.MeshBuilder.CreateDisc('dish', {
            radius: 0.8,
            tessellation: 16
        }, scene);
        dish.position.z = 1.5;
        dish.rotation.x = -Math.PI / 6;
        parts.push(dish);

        // Merge and create material
        const satellite = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
        satellite.name = 'satellite';

        const satMat = new BABYLON.StandardMaterial('satMat', scene);
        satMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.75);
        satMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        satMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.06);
        satellite.material = satMat;

        return satellite;
    }

    // Create astronaut
    function createAstronaut(scene, BABYLON, stationPosition) {
        const parts = [];

        // Helmet (sphere)
        const helmet = BABYLON.MeshBuilder.CreateSphere('helmet', {
            diameter: 1.2,
            segments: 16
        }, scene);
        helmet.position.y = 1.5;
        parts.push(helmet);

        // Visor
        const visor = BABYLON.MeshBuilder.CreateSphere('visor', {
            diameter: 1,
            segments: 16
        }, scene);
        visor.position.y = 1.5;
        visor.position.z = 0.3;
        visor.scaling.z = 0.3;
        parts.push(visor);

        // Body (torso)
        const torso = BABYLON.MeshBuilder.CreateBox('torso', {
            width: 1.2,
            height: 1.5,
            depth: 0.8
        }, scene);
        torso.position.y = 0.5;
        parts.push(torso);

        // Backpack (life support)
        const backpack = BABYLON.MeshBuilder.CreateBox('backpack', {
            width: 1,
            height: 1.2,
            depth: 0.5
        }, scene);
        backpack.position.y = 0.5;
        backpack.position.z = -0.6;
        parts.push(backpack);

        // Arms
        const armLeft = BABYLON.MeshBuilder.CreateCylinder('armLeft', {
            height: 1.2,
            diameter: 0.35
        }, scene);
        armLeft.position.set(-0.8, 0.6, 0);
        armLeft.rotation.z = Math.PI / 6;
        parts.push(armLeft);

        const armRight = BABYLON.MeshBuilder.CreateCylinder('armRight', {
            height: 1.2,
            diameter: 0.35
        }, scene);
        armRight.position.set(0.8, 0.6, 0);
        armRight.rotation.z = -Math.PI / 6;
        parts.push(armRight);

        // Legs
        const legLeft = BABYLON.MeshBuilder.CreateCylinder('legLeft', {
            height: 1.4,
            diameter: 0.4
        }, scene);
        legLeft.position.set(-0.35, -0.8, 0);
        parts.push(legLeft);

        const legRight = BABYLON.MeshBuilder.CreateCylinder('legRight', {
            height: 1.4,
            diameter: 0.4
        }, scene);
        legRight.position.set(0.35, -0.8, 0);
        parts.push(legRight);

        // Merge
        astronaut = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
        astronaut.name = 'astronaut';

        // Material (white suit)
        const suitMat = new BABYLON.StandardMaterial('suitMat', scene);
        suitMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
        suitMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        suitMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        astronaut.material = suitMat;

        // Position near station
        const offset = new BABYLON.Vector3(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 15,
            (Math.random() - 0.5) * 20
        );
        astronaut.position = stationPosition.add(offset);

        // Store movement data
        astronaut.metadata = {
            driftDirection: new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.05
            ),
            tumbleSpeed: new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01
            ),
            collisionRadius: 1.5
        };

        return astronaut;
    }

    // Update all obstacles
    function update(deltaTime) {
        obstacleTime += deltaTime;

        // Update asteroids (rotation only)
        asteroids.forEach(asteroid => {
            if (asteroid.metadata && asteroid.metadata.rotationSpeed) {
                asteroid.rotation.addInPlace(asteroid.metadata.rotationSpeed);
            }
        });

        // Update satellites (orbital movement)
        satellites.forEach(satellite => {
            if (satellite.metadata) {
                const { orbitRadius, orbitSpeed, orbitOffset, orbitHeight } = satellite.metadata;
                const angle = obstacleTime * orbitSpeed + orbitOffset;

                satellite.position.x = Math.cos(angle) * orbitRadius;
                satellite.position.z = Math.sin(angle) * orbitRadius;

                // Face direction of travel
                satellite.rotation.y = -angle + Math.PI / 2;
            }
        });

        // Update astronaut (drift and tumble)
        if (astronaut && astronaut.metadata) {
            const { driftDirection, tumbleSpeed } = astronaut.metadata;

            astronaut.position.addInPlace(driftDirection);
            astronaut.rotation.addInPlace(tumbleSpeed);
        }
    }

    // Get all obstacle meshes for collision checking
    function getAllObstacles() {
        const all = [...asteroids, ...satellites];
        if (astronaut) all.push(astronaut);
        return all;
    }

    // Dispose all obstacles
    function dispose() {
        asteroids.forEach(a => {
            if (a.material) a.material.dispose();
            a.dispose();
        });
        asteroids = [];

        satellites.forEach(s => {
            if (s.material) s.material.dispose();
            s.dispose();
        });
        satellites = [];

        if (astronaut) {
            if (astronaut.material) astronaut.material.dispose();
            astronaut.dispose();
            astronaut = null;
        }

        obstacleTime = 0;
    }

    return {
        create,
        update,
        getAllObstacles,
        dispose,
        get asteroids() { return asteroids; },
        get satellites() { return satellites; },
        get astronaut() { return astronaut; }
    };
})();
