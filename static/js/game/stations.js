/**
 * Space Docking Game - Space Stations
 * Creates various space station designs with docking ports
 */

const SpaceDockingStations = (() => {
    // Station meshes
    let stationMesh = null;
    let dockingPort = null;
    let dockingLights = [];
    let dockingBeacon = null;
    let dockingArrow = null;
    let dockingGlow = null;

    // Movement state
    let movePattern = null;
    let moveSpeed = 0;
    let moveTime = 0;
    let initialPosition = null;

    // Station preset builders
    const stationBuilders = {
        // Basic cylindrical station
        basic: (scene, BABYLON) => {
            const parts = [];

            // Main cylinder
            const mainBody = BABYLON.MeshBuilder.CreateCylinder('mainBody', {
                height: 15,
                diameter: 6
            }, scene);
            mainBody.rotation.x = Math.PI / 2;
            parts.push(mainBody);

            // End caps
            const cap1 = BABYLON.MeshBuilder.CreateSphere('cap1', {
                diameter: 6,
                segments: 16
            }, scene);
            cap1.position.z = 7.5;
            cap1.scaling.z = 0.3;
            parts.push(cap1);

            const cap2 = BABYLON.MeshBuilder.CreateSphere('cap2', {
                diameter: 6,
                segments: 16
            }, scene);
            cap2.position.z = -7.5;
            cap2.scaling.z = 0.3;
            parts.push(cap2);

            // Solar panels
            const panel1 = BABYLON.MeshBuilder.CreateBox('panel1', {
                width: 12,
                height: 0.2,
                depth: 4
            }, scene);
            panel1.position.x = 8;
            parts.push(panel1);

            const panel2 = BABYLON.MeshBuilder.CreateBox('panel2', {
                width: 12,
                height: 0.2,
                depth: 4
            }, scene);
            panel2.position.x = -8;
            parts.push(panel2);

            return { parts, dockingOffset: new BABYLON.Vector3(0, 0, 9) };
        },

        // Cross-shaped station
        cross: (scene, BABYLON) => {
            const parts = [];

            // Center hub
            const hub = BABYLON.MeshBuilder.CreateBox('hub', {
                size: 5
            }, scene);
            parts.push(hub);

            // Arms
            const armLength = 12;
            const armSize = 3;

            const arm1 = BABYLON.MeshBuilder.CreateBox('arm1', {
                width: armLength,
                height: armSize,
                depth: armSize
            }, scene);
            arm1.position.x = armLength / 2 + 2;
            parts.push(arm1);

            const arm2 = BABYLON.MeshBuilder.CreateBox('arm2', {
                width: armLength,
                height: armSize,
                depth: armSize
            }, scene);
            arm2.position.x = -armLength / 2 - 2;
            parts.push(arm2);

            const arm3 = BABYLON.MeshBuilder.CreateBox('arm3', {
                width: armSize,
                height: armSize,
                depth: armLength
            }, scene);
            arm3.position.z = armLength / 2 + 2;
            parts.push(arm3);

            const arm4 = BABYLON.MeshBuilder.CreateBox('arm4', {
                width: armSize,
                height: armSize,
                depth: armLength
            }, scene);
            arm4.position.z = -armLength / 2 - 2;
            parts.push(arm4);

            return { parts, dockingOffset: new BABYLON.Vector3(0, 0, armLength / 2 + 5) };
        },

        // Ring station
        ring: (scene, BABYLON) => {
            const parts = [];

            // Main ring
            const ring = BABYLON.MeshBuilder.CreateTorus('ring', {
                diameter: 20,
                thickness: 3,
                tessellation: 32
            }, scene);
            ring.rotation.x = Math.PI / 2;
            parts.push(ring);

            // Central hub
            const hub = BABYLON.MeshBuilder.CreateSphere('hub', {
                diameter: 6,
                segments: 16
            }, scene);
            parts.push(hub);

            // Spokes
            for (let i = 0; i < 4; i++) {
                const spoke = BABYLON.MeshBuilder.CreateCylinder('spoke' + i, {
                    height: 8,
                    diameter: 1
                }, scene);
                spoke.rotation.z = Math.PI / 2;
                spoke.rotation.y = (Math.PI / 2) * i;
                spoke.position.x = Math.cos((Math.PI / 2) * i) * 5;
                spoke.position.z = Math.sin((Math.PI / 2) * i) * 5;
                parts.push(spoke);
            }

            return { parts, dockingOffset: new BABYLON.Vector3(0, 5, 0) };
        },

        // Multi-module station
        multi: (scene, BABYLON) => {
            const parts = [];

            // Central module
            const central = BABYLON.MeshBuilder.CreateCylinder('central', {
                height: 8,
                diameter: 4
            }, scene);
            parts.push(central);

            // Side modules
            const modulePositions = [
                { x: 6, y: 0, z: 0 },
                { x: -6, y: 0, z: 0 },
                { x: 0, y: 0, z: 6 },
                { x: 0, y: 0, z: -6 }
            ];

            modulePositions.forEach((pos, i) => {
                const module = BABYLON.MeshBuilder.CreateCylinder('module' + i, {
                    height: 6,
                    diameter: 3
                }, scene);
                module.position.set(pos.x, pos.y, pos.z);
                parts.push(module);

                // Connecting tube
                const tube = BABYLON.MeshBuilder.CreateCylinder('tube' + i, {
                    height: 4,
                    diameter: 1.5
                }, scene);
                tube.position.set(pos.x / 2, pos.y / 2, pos.z / 2);
                if (pos.x !== 0) tube.rotation.z = Math.PI / 2;
                if (pos.z !== 0) tube.rotation.x = Math.PI / 2;
                parts.push(tube);
            });

            // Solar array
            const solarArray = BABYLON.MeshBuilder.CreateBox('solar', {
                width: 15,
                height: 0.2,
                depth: 5
            }, scene);
            solarArray.position.y = 6;
            parts.push(solarArray);

            return { parts, dockingOffset: new BABYLON.Vector3(0, 0, 9) };
        },

        // Complex station (for harder levels)
        complex: (scene, BABYLON) => {
            const parts = [];

            // Main truss
            const truss = BABYLON.MeshBuilder.CreateBox('truss', {
                width: 30,
                height: 2,
                depth: 2
            }, scene);
            parts.push(truss);

            // Habitation modules
            const hab1 = BABYLON.MeshBuilder.CreateCylinder('hab1', {
                height: 10,
                diameter: 5
            }, scene);
            hab1.position.set(-8, 0, 0);
            hab1.rotation.z = Math.PI / 2;
            parts.push(hab1);

            const hab2 = BABYLON.MeshBuilder.CreateCylinder('hab2', {
                height: 10,
                diameter: 5
            }, scene);
            hab2.position.set(8, 0, 0);
            hab2.rotation.z = Math.PI / 2;
            parts.push(hab2);

            // Lab module (vertical)
            const lab = BABYLON.MeshBuilder.CreateCylinder('lab', {
                height: 12,
                diameter: 4
            }, scene);
            lab.position.y = 7;
            parts.push(lab);

            // Solar arrays
            for (let i = -1; i <= 1; i += 2) {
                const panel = BABYLON.MeshBuilder.CreateBox('panel' + i, {
                    width: 20,
                    height: 0.1,
                    depth: 8
                }, scene);
                panel.position.set(i * 20, 0, 0);
                parts.push(panel);
            }

            // Radiators
            const rad1 = BABYLON.MeshBuilder.CreateBox('rad1', {
                width: 8,
                height: 12,
                depth: 0.2
            }, scene);
            rad1.position.set(0, 8, 4);
            parts.push(rad1);

            // Cupola
            const cupola = BABYLON.MeshBuilder.CreateSphere('cupola', {
                diameter: 3,
                segments: 16
            }, scene);
            cupola.position.set(0, 0, -5);
            parts.push(cupola);

            return { parts, dockingOffset: new BABYLON.Vector3(0, 0, -8) };
        },

        // Large station - extended complex with more modules
        large: (scene, BABYLON) => {
            const parts = [];

            // Main spine
            const spine = BABYLON.MeshBuilder.CreateBox('spine', {
                width: 4,
                height: 4,
                depth: 40
            }, scene);
            parts.push(spine);

            // Multiple habitat rings
            for (let i = -1; i <= 1; i++) {
                const ring = BABYLON.MeshBuilder.CreateTorus('ring' + i, {
                    diameter: 15,
                    thickness: 2,
                    tessellation: 32
                }, scene);
                ring.position.z = i * 15;
                ring.rotation.y = Math.PI / 2;
                parts.push(ring);
            }

            // Command module at front
            const command = BABYLON.MeshBuilder.CreateCylinder('command', {
                height: 8,
                diameterTop: 3,
                diameterBottom: 6
            }, scene);
            command.position.z = 24;
            command.rotation.x = Math.PI / 2;
            parts.push(command);

            // Engine section
            for (let i = 0; i < 4; i++) {
                const engine = BABYLON.MeshBuilder.CreateCylinder('engine' + i, {
                    height: 12,
                    diameter: 4
                }, scene);
                const angle = (i / 4) * Math.PI * 2;
                engine.position.x = Math.cos(angle) * 8;
                engine.position.y = Math.sin(angle) * 8;
                engine.position.z = -25;
                engine.rotation.x = Math.PI / 2;
                parts.push(engine);
            }

            // Solar arrays
            const solar1 = BABYLON.MeshBuilder.CreateBox('solar1', {
                width: 30,
                height: 0.2,
                depth: 10
            }, scene);
            solar1.position.x = 20;
            parts.push(solar1);

            const solar2 = BABYLON.MeshBuilder.CreateBox('solar2', {
                width: 30,
                height: 0.2,
                depth: 10
            }, scene);
            solar2.position.x = -20;
            parts.push(solar2);

            return { parts, dockingOffset: new BABYLON.Vector3(0, 0, 28) };
        },

        // Cruiser - elongated ship-like station
        cruiser: (scene, BABYLON) => {
            const parts = [];

            // Main hull - elongated diamond shape
            const hull = BABYLON.MeshBuilder.CreateCylinder('hull', {
                height: 50,
                diameterTop: 0,
                diameterBottom: 12
            }, scene);
            hull.rotation.x = Math.PI / 2;
            hull.position.z = -10;
            parts.push(hull);

            // Secondary hull
            const hull2 = BABYLON.MeshBuilder.CreateCylinder('hull2', {
                height: 30,
                diameterTop: 12,
                diameterBottom: 6
            }, scene);
            hull2.rotation.x = Math.PI / 2;
            hull2.position.z = 20;
            parts.push(hull2);

            // Bridge section
            const bridge = BABYLON.MeshBuilder.CreateBox('bridge', {
                width: 8,
                height: 4,
                depth: 12
            }, scene);
            bridge.position.y = 8;
            bridge.position.z = 20;
            parts.push(bridge);

            // Weapons/sensor arrays
            for (let i = 0; i < 3; i++) {
                const array = BABYLON.MeshBuilder.CreateBox('array' + i, {
                    width: 2,
                    height: 2,
                    depth: 8
                }, scene);
                array.position.z = -15 + i * 15;
                array.position.y = 8;
                parts.push(array);
            }

            // Fin structures
            const fin1 = BABYLON.MeshBuilder.CreateBox('fin1', {
                width: 0.5,
                height: 15,
                depth: 20
            }, scene);
            fin1.position.y = 10;
            fin1.position.z = -5;
            parts.push(fin1);

            const fin2 = BABYLON.MeshBuilder.CreateBox('fin2', {
                width: 15,
                height: 0.5,
                depth: 20
            }, scene);
            fin2.position.y = 0;
            fin2.position.z = -5;
            parts.push(fin2);

            // Engine nacelles
            const nacelle1 = BABYLON.MeshBuilder.CreateCylinder('nacelle1', {
                height: 20,
                diameter: 5
            }, scene);
            nacelle1.rotation.x = Math.PI / 2;
            nacelle1.position.x = 10;
            nacelle1.position.z = -25;
            parts.push(nacelle1);

            const nacelle2 = BABYLON.MeshBuilder.CreateCylinder('nacelle2', {
                height: 20,
                diameter: 5
            }, scene);
            nacelle2.rotation.x = Math.PI / 2;
            nacelle2.position.x = -10;
            nacelle2.position.z = -25;
            parts.push(nacelle2);

            return { parts, dockingOffset: new BABYLON.Vector3(0, -5, 38) };
        },

        // Carrier - massive ship with hangar bays
        carrier: (scene, BABYLON) => {
            const parts = [];

            // Main body - flat and wide
            const body = BABYLON.MeshBuilder.CreateBox('body', {
                width: 30,
                height: 10,
                depth: 60
            }, scene);
            parts.push(body);

            // Flight deck on top
            const deck = BABYLON.MeshBuilder.CreateBox('deck', {
                width: 35,
                height: 2,
                depth: 70
            }, scene);
            deck.position.y = 6;
            parts.push(deck);

            // Control tower
            const tower = BABYLON.MeshBuilder.CreateBox('tower', {
                width: 8,
                height: 15,
                depth: 12
            }, scene);
            tower.position.y = 14;
            tower.position.x = 12;
            tower.position.z = 15;
            parts.push(tower);

            // Hangar openings (visual)
            for (let i = -1; i <= 1; i += 2) {
                const hangar = BABYLON.MeshBuilder.CreateBox('hangar' + i, {
                    width: 10,
                    height: 6,
                    depth: 20
                }, scene);
                hangar.position.x = i * 8;
                hangar.position.y = 0;
                hangar.position.z = -25;
                parts.push(hangar);
            }

            // Engine section
            const engineBlock = BABYLON.MeshBuilder.CreateBox('engineBlock', {
                width: 25,
                height: 8,
                depth: 15
            }, scene);
            engineBlock.position.z = -40;
            parts.push(engineBlock);

            // Individual engines
            for (let x = -2; x <= 2; x++) {
                const engine = BABYLON.MeshBuilder.CreateCylinder('engine' + x, {
                    height: 10,
                    diameter: 4
                }, scene);
                engine.rotation.x = Math.PI / 2;
                engine.position.x = x * 5;
                engine.position.z = -50;
                parts.push(engine);
            }

            // Antenna arrays
            for (let i = 0; i < 3; i++) {
                const antenna = BABYLON.MeshBuilder.CreateCylinder('antenna' + i, {
                    height: 20,
                    diameter: 0.5
                }, scene);
                antenna.position.y = 25;
                antenna.position.x = -12 + i * 12;
                antenna.position.z = 20;
                parts.push(antenna);
            }

            return { parts, dockingOffset: new BABYLON.Vector3(-18, 0, 0) };
        },

        // Battleship - heavily armored and complex
        battleship: (scene, BABYLON) => {
            const parts = [];

            // Main hull - layered wedge
            const hull1 = BABYLON.MeshBuilder.CreateBox('hull1', {
                width: 20,
                height: 8,
                depth: 70
            }, scene);
            parts.push(hull1);

            const hull2 = BABYLON.MeshBuilder.CreateBox('hull2', {
                width: 15,
                height: 6,
                depth: 50
            }, scene);
            hull2.position.y = 7;
            hull2.position.z = -5;
            parts.push(hull2);

            // Command citadel
            const citadel = BABYLON.MeshBuilder.CreateBox('citadel', {
                width: 10,
                height: 10,
                depth: 15
            }, scene);
            citadel.position.y = 15;
            citadel.position.z = 10;
            parts.push(citadel);

            // Turret placements
            for (let i = 0; i < 4; i++) {
                const turret = BABYLON.MeshBuilder.CreateCylinder('turret' + i, {
                    height: 3,
                    diameter: 5
                }, scene);
                turret.position.y = 12;
                turret.position.z = -15 + i * 15;
                turret.position.x = (i % 2 === 0) ? 5 : -5;
                parts.push(turret);

                const barrel = BABYLON.MeshBuilder.CreateCylinder('barrel' + i, {
                    height: 10,
                    diameter: 1
                }, scene);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.y = 12;
                barrel.position.z = -10 + i * 15;
                barrel.position.x = (i % 2 === 0) ? 5 : -5;
                parts.push(barrel);
            }

            // Armor plates (side)
            for (let i = -1; i <= 1; i += 2) {
                const armor = BABYLON.MeshBuilder.CreateBox('armor' + i, {
                    width: 3,
                    height: 12,
                    depth: 50
                }, scene);
                armor.position.x = i * 13;
                armor.position.z = -5;
                parts.push(armor);
            }

            // Engine array
            const engineBase = BABYLON.MeshBuilder.CreateBox('engineBase', {
                width: 18,
                height: 10,
                depth: 10
            }, scene);
            engineBase.position.z = -42;
            parts.push(engineBase);

            for (let x = -1; x <= 1; x++) {
                for (let y = -1; y <= 1; y += 2) {
                    const engine = BABYLON.MeshBuilder.CreateCylinder('eng' + x + y, {
                        height: 12,
                        diameter: 4
                    }, scene);
                    engine.rotation.x = Math.PI / 2;
                    engine.position.x = x * 6;
                    engine.position.y = y * 3;
                    engine.position.z = -52;
                    parts.push(engine);
                }
            }

            // Bow section
            const bow = BABYLON.MeshBuilder.CreateCylinder('bow', {
                height: 15,
                diameterTop: 0,
                diameterBottom: 18
            }, scene);
            bow.rotation.x = -Math.PI / 2;
            bow.position.z = 42;
            parts.push(bow);

            return { parts, dockingOffset: new BABYLON.Vector3(0, 12, 50) };
        },

        // Mothership - absolutely massive with internal structure visible
        mothership: (scene, BABYLON) => {
            const parts = [];

            // Main body - massive sphere-like structure
            const mainBody = BABYLON.MeshBuilder.CreateSphere('mainBody', {
                diameter: 50,
                segments: 32
            }, scene);
            mainBody.scaling.y = 0.6;
            mainBody.scaling.z = 1.5;
            parts.push(mainBody);

            // Central spine
            const spine = BABYLON.MeshBuilder.CreateCylinder('spine', {
                height: 120,
                diameter: 8
            }, scene);
            spine.rotation.x = Math.PI / 2;
            parts.push(spine);

            // Multiple ring sections
            for (let i = -2; i <= 2; i++) {
                const ring = BABYLON.MeshBuilder.CreateTorus('ring' + i, {
                    diameter: 40 - Math.abs(i) * 5,
                    thickness: 3,
                    tessellation: 48
                }, scene);
                ring.position.z = i * 20;
                ring.rotation.y = Math.PI / 2;
                parts.push(ring);
            }

            // Command section (front)
            const command = BABYLON.MeshBuilder.CreateCylinder('command', {
                height: 20,
                diameterTop: 5,
                diameterBottom: 15
            }, scene);
            command.rotation.x = Math.PI / 2;
            command.position.z = 70;
            parts.push(command);

            // Massive engine section
            const engineRing = BABYLON.MeshBuilder.CreateTorus('engineRing', {
                diameter: 35,
                thickness: 6,
                tessellation: 48
            }, scene);
            engineRing.position.z = -60;
            engineRing.rotation.y = Math.PI / 2;
            parts.push(engineRing);

            // Engine cones
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const engine = BABYLON.MeshBuilder.CreateCylinder('engine' + i, {
                    height: 15,
                    diameterTop: 3,
                    diameterBottom: 6
                }, scene);
                engine.rotation.x = Math.PI / 2;
                engine.position.x = Math.cos(angle) * 15;
                engine.position.y = Math.sin(angle) * 15;
                engine.position.z = -70;
                parts.push(engine);
            }

            // Docking arms extending outward
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const arm = BABYLON.MeshBuilder.CreateBox('arm' + i, {
                    width: 4,
                    height: 4,
                    depth: 25
                }, scene);
                arm.position.x = Math.cos(angle) * 30;
                arm.position.y = Math.sin(angle) * 18;
                arm.position.z = 30;
                arm.rotation.z = angle;
                parts.push(arm);
            }

            // Sensor arrays
            for (let i = 0; i < 4; i++) {
                const sensor = BABYLON.MeshBuilder.CreateCylinder('sensor' + i, {
                    height: 30,
                    diameter: 2
                }, scene);
                const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                sensor.position.x = Math.cos(angle) * 25;
                sensor.position.y = Math.sin(angle) * 15;
                sensor.position.z = -20;
                parts.push(sensor);

                const dish = BABYLON.MeshBuilder.CreateSphere('dish' + i, {
                    diameter: 8,
                    segments: 16
                }, scene);
                dish.scaling.z = 0.3;
                dish.position.x = Math.cos(angle) * 25;
                dish.position.y = Math.sin(angle) * 15 + 18;
                dish.position.z = -20;
                parts.push(dish);
            }

            return { parts, dockingOffset: new BABYLON.Vector3(35, 0, 30) };
        }
    };

    // Create a station
    function create(scene, BABYLON, stationType, levelConfig) {
        dispose();

        const builder = stationBuilders[stationType] || stationBuilders.basic;
        const { parts, dockingOffset } = builder(scene, BABYLON);

        // Create material
        const stationMaterial = new BABYLON.StandardMaterial('stationMat', scene);
        stationMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.65);
        stationMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        stationMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.06);

        // Apply material to all parts
        parts.forEach(part => {
            part.material = stationMaterial;
        });

        // Merge all parts
        stationMesh = BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
        stationMesh.name = 'station';

        // Apply station scale from level config
        const scale = levelConfig.stationScale || 1.0;
        stationMesh.scaling = new BABYLON.Vector3(scale, scale, scale);

        // Create docking port with enhanced visibility (scale the offset too)
        const scaledOffset = dockingOffset.scale(scale);
        createDockingPort(scene, BABYLON, scaledOffset, scale);

        // Position station
        const distance = levelConfig.stationDistance || 50;
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.5) * 30;

        initialPosition = new BABYLON.Vector3(
            Math.cos(angle) * distance,
            elevation,
            Math.sin(angle) * distance
        );

        stationMesh.position = initialPosition.clone();

        // Random rotation
        stationMesh.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 0.5,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 0.5
        );

        // Setup movement
        movePattern = levelConfig.moving ? (levelConfig.movePattern || 'linear') : null;
        moveSpeed = levelConfig.moveSpeed || 0;
        moveTime = 0;

        return stationMesh;
    }

    // Create docking port with enhanced visibility
    function createDockingPort(scene, BABYLON, offset, scale = 1) {
        // Scale the docking port visuals based on station scale
        const portScale = Math.max(1, scale * 0.8);

        // Docking ring
        dockingPort = BABYLON.MeshBuilder.CreateTorus('dockingPort', {
            diameter: 4 * portScale,
            thickness: 0.5 * portScale,
            tessellation: 32
        }, scene);

        // Position relative to station
        dockingPort.parent = stationMesh;
        dockingPort.position = offset.clone();

        // Rotate to face outward
        dockingPort.rotation.x = Math.PI / 2;

        // Docking port material - bright and visible
        const portMaterial = new BABYLON.StandardMaterial('portMat', scene);
        portMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);
        portMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.1);
        portMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        dockingPort.material = portMaterial;

        // Create glowing outline ring (larger, behind docking port)
        dockingGlow = BABYLON.MeshBuilder.CreateTorus('dockingGlow', {
            diameter: 6 * portScale,
            thickness: 0.3 * portScale,
            tessellation: 32
        }, scene);
        dockingGlow.parent = stationMesh;
        dockingGlow.position = offset.clone();
        dockingGlow.position.z += 0.5 * portScale; // Slightly behind
        dockingGlow.rotation.x = Math.PI / 2;

        const glowMat = new BABYLON.StandardMaterial('glowMat', scene);
        glowMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
        glowMat.disableLighting = true;
        glowMat.alpha = 0.6;
        dockingGlow.material = glowMat;

        // Create beacon/arrow pointing to docking port
        createDockingBeacon(scene, BABYLON, offset, portScale);

        // Docking lights
        createDockingLights(scene, BABYLON, offset, portScale);
    }

    // Create a beacon that points to the docking port
    function createDockingBeacon(scene, BABYLON, offset, scale = 1) {
        // Large pulsing sphere beacon
        dockingBeacon = BABYLON.MeshBuilder.CreateSphere('beacon', {
            diameter: 2 * scale,
            segments: 16
        }, scene);
        dockingBeacon.parent = stationMesh;
        dockingBeacon.position = offset.clone();
        dockingBeacon.position.z += 8 * scale; // In front of docking port

        const beaconMat = new BABYLON.StandardMaterial('beaconMat', scene);
        beaconMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
        beaconMat.disableLighting = true;
        beaconMat.alpha = 0.8;
        dockingBeacon.material = beaconMat;

        // Arrow pointing toward dock
        dockingArrow = BABYLON.MeshBuilder.CreateCylinder('arrow', {
            height: 5 * scale,
            diameterTop: 0,
            diameterBottom: 1.5 * scale,
            tessellation: 8
        }, scene);
        dockingArrow.parent = stationMesh;
        dockingArrow.position = offset.clone();
        dockingArrow.position.z += 5 * scale;
        dockingArrow.rotation.x = -Math.PI / 2; // Point toward dock

        const arrowMat = new BABYLON.StandardMaterial('arrowMat', scene);
        arrowMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
        arrowMat.disableLighting = true;
        arrowMat.alpha = 0.7;
        dockingArrow.material = arrowMat;
    }

    // Create indicator lights around docking port
    function createDockingLights(scene, BABYLON, offset, scale = 1) {
        dockingLights = [];

        const lightPositions = [
            { angle: 0 },
            { angle: Math.PI / 2 },
            { angle: Math.PI },
            { angle: Math.PI * 1.5 }
        ];

        lightPositions.forEach((pos, i) => {
            const light = BABYLON.MeshBuilder.CreateSphere('dockLight' + i, {
                diameter: 0.6 * scale,
                segments: 8
            }, scene);

            light.parent = stationMesh;
            light.position = offset.clone();
            light.position.x += Math.cos(pos.angle) * 2.5 * scale;
            light.position.y += Math.sin(pos.angle) * 2.5 * scale;

            const lightMat = new BABYLON.StandardMaterial('lightMat' + i, scene);
            lightMat.emissiveColor = new BABYLON.Color3(0.2, 1, 0.2);
            lightMat.disableLighting = true;
            light.material = lightMat;

            dockingLights.push({ mesh: light, material: lightMat });
        });
    }

    // Update station (movement, lights)
    function update(deltaTime, playerDistance) {
        if (!stationMesh) return;

        moveTime += deltaTime;

        // Apply movement pattern
        if (movePattern && moveSpeed > 0) {
            switch (movePattern) {
                case 'linear':
                    // Back and forth
                    const linearOffset = Math.sin(moveTime * moveSpeed) * 10;
                    stationMesh.position.x = initialPosition.x + linearOffset;
                    break;

                case 'orbit':
                    // Circular orbit
                    const orbitRadius = 10;
                    stationMesh.position.x = initialPosition.x + Math.cos(moveTime * moveSpeed) * orbitRadius;
                    stationMesh.position.z = initialPosition.z + Math.sin(moveTime * moveSpeed) * orbitRadius;
                    break;

                case 'figure8':
                    // Figure-8 pattern
                    const fig8Scale = 15;
                    stationMesh.position.x = initialPosition.x + Math.sin(moveTime * moveSpeed) * fig8Scale;
                    stationMesh.position.z = initialPosition.z + Math.sin(moveTime * moveSpeed * 2) * (fig8Scale / 2);
                    break;

                case 'erratic':
                    // Unpredictable movement
                    stationMesh.position.x = initialPosition.x +
                        Math.sin(moveTime * moveSpeed) * 8 +
                        Math.cos(moveTime * moveSpeed * 1.7) * 5;
                    stationMesh.position.y = initialPosition.y +
                        Math.sin(moveTime * moveSpeed * 0.8) * 6;
                    stationMesh.position.z = initialPosition.z +
                        Math.cos(moveTime * moveSpeed * 1.3) * 8;
                    break;
            }

            // Gentle rotation
            stationMesh.rotation.y += moveSpeed * 0.01;
        }

        // Update docking lights and beacon based on player distance
        updateDockingVisuals(playerDistance);
    }

    // Update docking visuals (lights, beacon, glow)
    function updateDockingVisuals(distance) {
        const time = Date.now() * 0.005;
        const pulse = 0.5 + Math.sin(time) * 0.5;
        const fastPulse = 0.5 + Math.sin(time * 3) * 0.5;

        // Determine color based on distance
        let color;
        if (distance < SpaceDockingPhysics.DOCK_COMPLETE_RANGE) {
            color = new BABYLON.Color3(0.2, 1, 0.2); // Green - docked
        } else if (distance < SpaceDockingPhysics.SOFT_DOCK_RANGE) {
            color = new BABYLON.Color3(1, 1, 0.2); // Yellow - close
        } else if (distance < 30) {
            color = new BABYLON.Color3(1, 0.6, 0.2); // Orange - approaching
        } else {
            color = new BABYLON.Color3(0, 1, 0); // Green - far (beacon mode)
        }

        // Update docking lights
        dockingLights.forEach(light => {
            light.material.emissiveColor = color.scale(0.7 + pulse * 0.3);
        });

        // Update glow ring
        if (dockingGlow && dockingGlow.material) {
            dockingGlow.material.emissiveColor = color;
            dockingGlow.material.alpha = 0.4 + pulse * 0.4;
            // Scale pulsing
            const glowScale = 1 + pulse * 0.2;
            dockingGlow.scaling.set(glowScale, glowScale, 1);
        }

        // Update beacon
        if (dockingBeacon && dockingBeacon.material) {
            dockingBeacon.material.emissiveColor = color;
            dockingBeacon.material.alpha = 0.5 + fastPulse * 0.5;
            // Scale pulsing
            const beaconScale = 1 + fastPulse * 0.3;
            dockingBeacon.scaling.set(beaconScale, beaconScale, beaconScale);
        }

        // Update arrow
        if (dockingArrow && dockingArrow.material) {
            dockingArrow.material.emissiveColor = color;
            dockingArrow.material.alpha = 0.5 + pulse * 0.3;
        }
    }

    // Get docking port world position
    function getDockingPortPosition() {
        if (!dockingPort || !stationMesh) return null;

        // Get world position of docking port
        const worldMatrix = dockingPort.getWorldMatrix();
        const worldPos = BABYLON.Vector3.TransformCoordinates(
            BABYLON.Vector3.Zero(),
            worldMatrix
        );

        return worldPos;
    }

    // Get docking port world rotation for alignment
    function getDockingPortRotation() {
        if (!dockingPort || !stationMesh) return null;
        return stationMesh.rotation.clone();
    }

    // Dispose of station
    function dispose() {
        dockingLights.forEach(light => {
            if (light.mesh) light.mesh.dispose();
            if (light.material) light.material.dispose();
        });
        dockingLights = [];

        if (dockingBeacon) {
            dockingBeacon.dispose();
            dockingBeacon = null;
        }

        if (dockingArrow) {
            dockingArrow.dispose();
            dockingArrow = null;
        }

        if (dockingGlow) {
            dockingGlow.dispose();
            dockingGlow = null;
        }

        if (dockingPort) {
            dockingPort.dispose();
            dockingPort = null;
        }

        if (stationMesh) {
            stationMesh.dispose();
            stationMesh = null;
        }

        movePattern = null;
        moveSpeed = 0;
        moveTime = 0;
        initialPosition = null;
    }

    return {
        create,
        update,
        getDockingPortPosition,
        getDockingPortRotation,
        dispose,
        get mesh() { return stationMesh; },
        get dockingPort() { return dockingPort; }
    };
})();
