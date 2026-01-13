/**
 * Space Docking Game - Player Spaceship
 * Creates and manages the player's spacecraft with customization
 */

const SpaceDockingPlayer = (() => {
    // Player state
    let mesh = null;
    let thrusterParticles = [];
    let fuel = 100;
    let maxFuel = 100;
    let engineGlows = [];

    // Customization state
    let currentShipType = 'default';
    let currentShipColor = { r: 0.9, g: 0.9, b: 0.95 };
    let currentBoostColor = { r: 1, g: 0.4, b: 0 };

    // Ship type builders
    const shipBuilders = {
        // Original default ship
        default: (scene, BABYLON) => {
            const parts = [];

            // Main body - elongated octahedron shape
            const body = BABYLON.MeshBuilder.CreatePolyhedron('playerBody', {
                type: 1, // Octahedron
                size: 1.5
            }, scene);
            body.scaling = new BABYLON.Vector3(0.8, 0.6, 1.5);
            parts.push(body);

            // Cockpit - small sphere at front
            const cockpit = BABYLON.MeshBuilder.CreateSphere('cockpit', {
                diameter: 0.8,
                segments: 16
            }, scene);
            cockpit.position.z = 1.2;
            cockpit.position.y = 0.2;
            parts.push(cockpit);

            // Wings
            const wingLeft = BABYLON.MeshBuilder.CreateBox('wingLeft', {
                width: 2,
                height: 0.1,
                depth: 1.2
            }, scene);
            wingLeft.position.x = -1.2;
            wingLeft.position.z = -0.3;
            wingLeft.rotation.z = Math.PI * 0.1;
            parts.push(wingLeft);

            const wingRight = BABYLON.MeshBuilder.CreateBox('wingRight', {
                width: 2,
                height: 0.1,
                depth: 1.2
            }, scene);
            wingRight.position.x = 1.2;
            wingRight.position.z = -0.3;
            wingRight.rotation.z = -Math.PI * 0.1;
            parts.push(wingRight);

            // Engine pods
            const engineLeft = BABYLON.MeshBuilder.CreateCylinder('engineLeft', {
                height: 1.5,
                diameter: 0.5
            }, scene);
            engineLeft.rotation.x = Math.PI / 2;
            engineLeft.position.x = -0.8;
            engineLeft.position.z = -1.5;
            parts.push(engineLeft);

            const engineRight = BABYLON.MeshBuilder.CreateCylinder('engineRight', {
                height: 1.5,
                diameter: 0.5
            }, scene);
            engineRight.rotation.x = Math.PI / 2;
            engineRight.position.x = 0.8;
            engineRight.position.z = -1.5;
            parts.push(engineRight);

            return {
                parts,
                enginePositions: [
                    { x: -0.8, y: 0, z: -2.2 },
                    { x: 0.8, y: 0, z: -2.2 }
                ]
            };
        },

        // Enterprise-style ship (saucer + nacelles)
        enterprise: (scene, BABYLON) => {
            const parts = [];

            // Saucer section
            const saucer = BABYLON.MeshBuilder.CreateCylinder('saucer', {
                height: 0.5,
                diameter: 3
            }, scene);
            saucer.position.z = 1;
            parts.push(saucer);

            // Engineering hull
            const hull = BABYLON.MeshBuilder.CreateCylinder('hull', {
                height: 3,
                diameter: 0.8
            }, scene);
            hull.rotation.x = Math.PI / 2;
            hull.position.z = -1;
            parts.push(hull);

            // Neck connecting saucer to hull
            const neck = BABYLON.MeshBuilder.CreateCylinder('neck', {
                height: 1.2,
                diameter: 0.4
            }, scene);
            neck.rotation.x = Math.PI / 3;
            neck.position.z = 0.2;
            neck.position.y = -0.3;
            parts.push(neck);

            // Nacelle pylons
            const pylon1 = BABYLON.MeshBuilder.CreateBox('pylon1', {
                width: 0.15,
                height: 0.8,
                depth: 0.8
            }, scene);
            pylon1.position.x = -1;
            pylon1.position.y = 0.6;
            pylon1.position.z = -1.5;
            parts.push(pylon1);

            const pylon2 = BABYLON.MeshBuilder.CreateBox('pylon2', {
                width: 0.15,
                height: 0.8,
                depth: 0.8
            }, scene);
            pylon2.position.x = 1;
            pylon2.position.y = 0.6;
            pylon2.position.z = -1.5;
            parts.push(pylon2);

            // Nacelles
            const nacelle1 = BABYLON.MeshBuilder.CreateCylinder('nacelle1', {
                height: 2.5,
                diameter: 0.5
            }, scene);
            nacelle1.rotation.x = Math.PI / 2;
            nacelle1.position.x = -1;
            nacelle1.position.y = 1;
            nacelle1.position.z = -1.5;
            parts.push(nacelle1);

            const nacelle2 = BABYLON.MeshBuilder.CreateCylinder('nacelle2', {
                height: 2.5,
                diameter: 0.5
            }, scene);
            nacelle2.rotation.x = Math.PI / 2;
            nacelle2.position.x = 1;
            nacelle2.position.y = 1;
            nacelle2.position.z = -1.5;
            parts.push(nacelle2);

            // Nacelle caps (front)
            const cap1 = BABYLON.MeshBuilder.CreateSphere('cap1', { diameter: 0.5 }, scene);
            cap1.position.set(-1, 1, -0.2);
            parts.push(cap1);

            const cap2 = BABYLON.MeshBuilder.CreateSphere('cap2', { diameter: 0.5 }, scene);
            cap2.position.set(1, 1, -0.2);
            parts.push(cap2);

            return {
                parts,
                enginePositions: [
                    { x: -1, y: 1, z: -2.8 },
                    { x: 1, y: 1, z: -2.8 }
                ]
            };
        },

        // X-Wing style ship
        xwing: (scene, BABYLON) => {
            const parts = [];

            // Fuselage
            const fuselage = BABYLON.MeshBuilder.CreateCylinder('fuselage', {
                height: 4,
                diameterTop: 0.6,
                diameterBottom: 0.8
            }, scene);
            fuselage.rotation.x = Math.PI / 2;
            parts.push(fuselage);

            // Cockpit
            const cockpit = BABYLON.MeshBuilder.CreateSphere('cockpit', {
                diameter: 1,
                segments: 16
            }, scene);
            cockpit.position.z = 1.2;
            cockpit.scaling.z = 1.5;
            parts.push(cockpit);

            // S-foils (4 wings)
            const wingAngles = [0.3, -0.3, Math.PI + 0.3, Math.PI - 0.3];
            wingAngles.forEach((angle, i) => {
                const wing = BABYLON.MeshBuilder.CreateBox('wing' + i, {
                    width: 3,
                    height: 0.08,
                    depth: 1
                }, scene);
                wing.position.x = Math.cos(angle) * 1.5;
                wing.position.y = Math.sin(angle) * 1.5;
                wing.position.z = -0.5;
                wing.rotation.z = angle;
                parts.push(wing);

                // Engine at wing tip
                const engine = BABYLON.MeshBuilder.CreateCylinder('wengine' + i, {
                    height: 1.5,
                    diameter: 0.4
                }, scene);
                engine.rotation.x = Math.PI / 2;
                engine.position.x = Math.cos(angle) * 2.8;
                engine.position.y = Math.sin(angle) * 2.8;
                engine.position.z = -1;
                parts.push(engine);
            });

            return {
                parts,
                enginePositions: [
                    { x: -2.8, y: 0.8, z: -1.8 },
                    { x: 2.8, y: 0.8, z: -1.8 },
                    { x: -2.8, y: -0.8, z: -1.8 },
                    { x: 2.8, y: -0.8, z: -1.8 }
                ]
            };
        },

        // Y-Wing style ship
        ywing: (scene, BABYLON) => {
            const parts = [];

            // Main body/cockpit
            const body = BABYLON.MeshBuilder.CreateCylinder('body', {
                height: 3,
                diameterTop: 0.8,
                diameterBottom: 1.2
            }, scene);
            body.rotation.x = Math.PI / 2;
            body.position.z = 0.5;
            parts.push(body);

            // Cockpit dome
            const cockpitDome = BABYLON.MeshBuilder.CreateSphere('cockpitDome', {
                diameter: 1.2,
                segments: 16
            }, scene);
            cockpitDome.position.z = 2;
            cockpitDome.scaling.z = 0.6;
            parts.push(cockpitDome);

            // Central strut
            const strut = BABYLON.MeshBuilder.CreateBox('strut', {
                width: 0.3,
                height: 0.3,
                depth: 4
            }, scene);
            strut.position.z = -1.5;
            parts.push(strut);

            // Engine nacelles (long)
            const nacelle1 = BABYLON.MeshBuilder.CreateCylinder('nacelle1', {
                height: 5,
                diameter: 0.6
            }, scene);
            nacelle1.rotation.x = Math.PI / 2;
            nacelle1.position.x = -1.2;
            nacelle1.position.z = -1.5;
            parts.push(nacelle1);

            const nacelle2 = BABYLON.MeshBuilder.CreateCylinder('nacelle2', {
                height: 5,
                diameter: 0.6
            }, scene);
            nacelle2.rotation.x = Math.PI / 2;
            nacelle2.position.x = 1.2;
            nacelle2.position.z = -1.5;
            parts.push(nacelle2);

            // Engine housings
            const housing1 = BABYLON.MeshBuilder.CreateBox('housing1', {
                width: 0.8,
                height: 0.8,
                depth: 1.5
            }, scene);
            housing1.position.x = -1.2;
            housing1.position.z = -4;
            parts.push(housing1);

            const housing2 = BABYLON.MeshBuilder.CreateBox('housing2', {
                width: 0.8,
                height: 0.8,
                depth: 1.5
            }, scene);
            housing2.position.x = 1.2;
            housing2.position.z = -4;
            parts.push(housing2);

            // Connecting struts to nacelles
            const conn1 = BABYLON.MeshBuilder.CreateBox('conn1', {
                width: 1,
                height: 0.2,
                depth: 0.5
            }, scene);
            conn1.position.x = -0.6;
            conn1.position.z = 0;
            parts.push(conn1);

            const conn2 = BABYLON.MeshBuilder.CreateBox('conn2', {
                width: 1,
                height: 0.2,
                depth: 0.5
            }, scene);
            conn2.position.x = 0.6;
            conn2.position.z = 0;
            parts.push(conn2);

            return {
                parts,
                enginePositions: [
                    { x: -1.2, y: 0, z: -4.8 },
                    { x: 1.2, y: 0, z: -4.8 }
                ]
            };
        },

        // ICBM/Missile style ship
        icbm: (scene, BABYLON) => {
            const parts = [];

            // Main body - long cylinder
            const body = BABYLON.MeshBuilder.CreateCylinder('body', {
                height: 5,
                diameter: 1
            }, scene);
            body.rotation.x = Math.PI / 2;
            parts.push(body);

            // Nose cone
            const nose = BABYLON.MeshBuilder.CreateCylinder('nose', {
                height: 2,
                diameterTop: 0,
                diameterBottom: 1
            }, scene);
            nose.rotation.x = Math.PI / 2;
            nose.position.z = 3.5;
            parts.push(nose);

            // Fins (4)
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const fin = BABYLON.MeshBuilder.CreateBox('fin' + i, {
                    width: 0.1,
                    height: 1.5,
                    depth: 1.5
                }, scene);
                fin.position.x = Math.cos(angle) * 0.5;
                fin.position.y = Math.sin(angle) * 0.5;
                fin.position.z = -2;
                fin.rotation.z = angle;
                parts.push(fin);
            }

            // Engine nozzle
            const nozzle = BABYLON.MeshBuilder.CreateCylinder('nozzle', {
                height: 0.8,
                diameterTop: 0.9,
                diameterBottom: 1.1
            }, scene);
            nozzle.rotation.x = Math.PI / 2;
            nozzle.position.z = -2.9;
            parts.push(nozzle);

            // Thruster ring
            const ring = BABYLON.MeshBuilder.CreateTorus('ring', {
                diameter: 1.2,
                thickness: 0.1,
                tessellation: 16
            }, scene);
            ring.position.z = -2.5;
            parts.push(ring);

            return {
                parts,
                enginePositions: [
                    { x: 0, y: 0, z: -3.5 }
                ]
            };
        }
    };

    // Fuel consumption rates
    const FUEL_IDLE = 0.01;
    const FUEL_THRUST = 0.15;
    const FUEL_BOOST = 0.4;

    // Thrust forces
    const THRUST_FORCE = 0.008;
    const BOOST_MULTIPLIER = 2.5;
    const ROTATION_FORCE = 0.003;

    // Create player spaceship mesh
    function create(scene, BABYLON, shipType = null) {
        // Use saved ship type if not specified
        if (!shipType) {
            shipType = currentShipType;
        }

        // Get the builder for this ship type
        const builder = shipBuilders[shipType] || shipBuilders.default;
        const { parts, enginePositions } = builder(scene, BABYLON);

        // Merge into single mesh
        mesh = BABYLON.Mesh.MergeMeshes(
            parts,
            true, true, undefined, false, true
        );
        mesh.name = 'playerShip';

        // Create materials with current ship color
        const bodyMaterial = new BABYLON.StandardMaterial('playerMaterial', scene);
        bodyMaterial.diffuseColor = new BABYLON.Color3(currentShipColor.r, currentShipColor.g, currentShipColor.b);
        bodyMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        bodyMaterial.emissiveColor = new BABYLON.Color3(
            currentShipColor.r * 0.1,
            currentShipColor.g * 0.1,
            currentShipColor.b * 0.12
        );
        mesh.material = bodyMaterial;

        // Create engine glows with dynamic positions
        createEngineGlows(scene, BABYLON, enginePositions);

        // Create thruster particle effects
        createThrusterParticles(scene, BABYLON, enginePositions);

        // Initial position
        mesh.position = new BABYLON.Vector3(0, 0, 0);

        // Store current ship type
        currentShipType = shipType;

        return mesh;
    }

    // Set ship type and recreate mesh
    function setShipType(scene, BABYLON, shipType) {
        if (!shipBuilders[shipType]) return;

        currentShipType = shipType;

        // Store current position/rotation if mesh exists
        let pos = null, rot = null;
        if (mesh) {
            pos = mesh.position.clone();
            rot = mesh.rotation.clone();
        }

        // Dispose and recreate
        dispose();
        create(scene, BABYLON, shipType);

        // Restore position/rotation
        if (pos && rot) {
            mesh.position = pos;
            mesh.rotation = rot;
        }

        // Save to settings
        saveCustomization();
    }

    // Set ship color
    function setShipColor(color) {
        currentShipColor = color;
        if (mesh && mesh.material) {
            mesh.material.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
            mesh.material.emissiveColor = new BABYLON.Color3(color.r * 0.1, color.g * 0.1, color.b * 0.12);
        }
        saveCustomization();
    }

    // Set boost/thruster color
    function setBoostColor(color) {
        currentBoostColor = color;
        updateThrusterColors();
        saveCustomization();
    }

    // Update thruster colors
    function updateThrusterColors() {
        thrusterParticles.forEach(particles => {
            particles.color1 = new BABYLON.Color4(currentBoostColor.r, currentBoostColor.g * 0.6, currentBoostColor.b * 0.3, 1);
            particles.color2 = new BABYLON.Color4(currentBoostColor.r, currentBoostColor.g * 0.3, currentBoostColor.b * 0.1, 1);
        });

        engineGlows.forEach(glow => {
            glow.innerMat.emissiveColor = new BABYLON.Color3(currentBoostColor.r, currentBoostColor.g * 0.6, currentBoostColor.b * 0.2);
            glow.outerMat.emissiveColor = new BABYLON.Color3(currentBoostColor.r, currentBoostColor.g * 0.4, currentBoostColor.b * 0.1);
        });
    }

    // Save customization to localStorage
    function saveCustomization() {
        try {
            const customization = {
                shipType: currentShipType,
                shipColor: currentShipColor,
                boostColor: currentBoostColor
            };
            localStorage.setItem('spaceDockingCustomization', JSON.stringify(customization));
        } catch (e) {
            console.warn('Failed to save customization:', e);
        }
    }

    // Load customization from localStorage
    function loadCustomization() {
        try {
            const saved = localStorage.getItem('spaceDockingCustomization');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.shipType) currentShipType = data.shipType;
                if (data.shipColor) currentShipColor = data.shipColor;
                if (data.boostColor) currentBoostColor = data.boostColor;
            }
        } catch (e) {
            console.warn('Failed to load customization:', e);
        }
    }

    // Initialize - load saved customization
    loadCustomization();

    // Create glowing engine cones
    function createEngineGlows(scene, BABYLON, enginePositions) {
        engineGlows = [];

        enginePositions.forEach((pos, i) => {
            // Inner bright glow
            const innerGlow = BABYLON.MeshBuilder.CreateCylinder('engineGlowInner' + i, {
                height: 1.5,
                diameterTop: 0.1,
                diameterBottom: 0.6,
                tessellation: 16
            }, scene);
            innerGlow.rotation.x = Math.PI / 2;
            innerGlow.position.set(pos.x, pos.y, pos.z);
            innerGlow.parent = mesh;

            const innerMat = new BABYLON.StandardMaterial('innerGlowMat' + i, scene);
            innerMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0);
            innerMat.disableLighting = true;
            innerMat.alpha = 0;
            innerGlow.material = innerMat;

            // Outer glow cone
            const outerGlow = BABYLON.MeshBuilder.CreateCylinder('engineGlowOuter' + i, {
                height: 2.5,
                diameterTop: 0,
                diameterBottom: 1.2,
                tessellation: 16
            }, scene);
            outerGlow.rotation.x = Math.PI / 2;
            outerGlow.position.set(pos.x, pos.y, pos.z - 0.5);
            outerGlow.parent = mesh;

            const outerMat = new BABYLON.StandardMaterial('outerGlowMat' + i, scene);
            outerMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0);
            outerMat.disableLighting = true;
            outerMat.alpha = 0;
            outerGlow.material = outerMat;

            engineGlows.push({
                inner: innerGlow,
                outer: outerGlow,
                innerMat: innerMat,
                outerMat: outerMat
            });
        });
    }

    // Create thruster particle systems
    function createThrusterParticles(scene, BABYLON, enginePositions) {
        thrusterParticles = [];

        enginePositions.forEach((pos, i) => {
            const particles = new BABYLON.ParticleSystem('thrusters' + i, 500, scene);

            // Texture (simple circle)
            particles.particleTexture = new BABYLON.Texture(
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABqklEQVRYhe2XsU7DMBCGv1RCLExMSEgsLKxsSIyMLOxsrEi8AC/AK/AKvAIjIwsbEgMTE0hMSJ0BqiLhOjlXYkLql6LEduz7c/87+y7GGGbZOrM8+r+AA3oREVJKZz3Ht7W/xZ5NKg4A7gE/PQS+OOjVAeBT4AngNnDuoJcHgLWLu8ApkDvoRQRwAPAUCID7DnotD/6VBsAl4Jm+P/ZWywOgGQG3gc9AfJMYMNIA6OV8Tw/4A2YAD/y1DABqANyucwC4kcvlXK0GAB1lLZdzyQFQLQKgbG5ZVssB+FRZwOVyAH6ukQfANxUA7ELkci7nJQC4VAJwr7kEwCVJWAu4VALwqQTgXgsAl8oA8KwEgHMlALcrATiXBCBgLwB3KgCYR8D9SgCuuARgqwzgRx4A3JcDwLdWALxQBsCZJAD7WgLwWBkA91YCsFYVAGeSAKyrAuBeLQBLqgJYlQPAWRKAw1oBuJAEYKkqgBNJAK6rBGCuJADn0v//HxEBzHcdOqDfATBT6e2OuuO+fW3p/2f6+Bm4u1zF1/+XtdbkBaCUmhsATu2i1moLwPnvG7h/bF/5CxPFvlMNIjlWAAAAAElFTkSuQmCC',
                scene
            );

            // Emitter position relative to ship
            const emitterMesh = BABYLON.MeshBuilder.CreateBox('emitter' + i, { size: 0.1 }, scene);
            emitterMesh.position.set(pos.x, pos.y, pos.z);
            emitterMesh.parent = mesh;
            emitterMesh.isVisible = false;
            particles.emitter = emitterMesh;

            particles.minEmitBox = new BABYLON.Vector3(-0.2, -0.2, 0);
            particles.maxEmitBox = new BABYLON.Vector3(0.2, 0.2, 0);

            // Orange/yellow flame colors
            particles.color1 = new BABYLON.Color4(1, 0.6, 0, 1);
            particles.color2 = new BABYLON.Color4(1, 0.3, 0, 1);
            particles.colorDead = new BABYLON.Color4(0.3, 0.1, 0, 0);

            particles.minSize = 0.3;
            particles.maxSize = 0.8;

            particles.minLifeTime = 0.1;
            particles.maxLifeTime = 0.4;

            particles.emitRate = 0;

            // Direction - behind the ship
            particles.direction1 = new BABYLON.Vector3(-0.3, -0.3, -1);
            particles.direction2 = new BABYLON.Vector3(0.3, 0.3, -1);

            particles.minEmitPower = 8;
            particles.maxEmitPower = 15;

            particles.updateSpeed = 0.02;

            particles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

            particles.start();
            thrusterParticles.push(particles);
        });
    }

    // Update player based on input
    function update(input, deltaTime) {
        if (!mesh) return;

        let fuelUsed = FUEL_IDLE * deltaTime;
        let thrustMultiplier = 1;

        // Check for boost
        if (input.boost && fuel > 0) {
            thrustMultiplier = BOOST_MULTIPLIER;
            fuelUsed += FUEL_BOOST * deltaTime;
        }

        // Apply movement thrust
        const hasThrust = input.forward !== 0 || input.right !== 0 || input.up !== 0;

        if (hasThrust && fuel > 0) {
            const thrustForce = THRUST_FORCE * thrustMultiplier;

            if (input.forward !== 0) {
                SpaceDockingPhysics.applyThrust(
                    new BABYLON.Vector3(0, 0, input.forward),
                    thrustForce,
                    mesh
                );
                fuelUsed += FUEL_THRUST * Math.abs(input.forward) * deltaTime;
            }

            if (input.right !== 0) {
                SpaceDockingPhysics.applyThrust(
                    new BABYLON.Vector3(input.right, 0, 0),
                    thrustForce * 0.8,
                    mesh
                );
                fuelUsed += FUEL_THRUST * Math.abs(input.right) * deltaTime;
            }

            if (input.up !== 0) {
                SpaceDockingPhysics.applyThrust(
                    new BABYLON.Vector3(0, input.up, 0),
                    thrustForce * 0.8,
                    mesh
                );
                fuelUsed += FUEL_THRUST * Math.abs(input.up) * deltaTime;
            }
        }

        // Apply rotation
        if (input.roll !== 0) {
            SpaceDockingPhysics.applyTorque(
                new BABYLON.Vector3(0, 0, input.roll),
                ROTATION_FORCE
            );
        }

        if (input.pitch !== 0) {
            mesh.rotation.x += input.pitch;
        }

        if (input.yaw !== 0) {
            mesh.rotation.y += input.yaw;
        }

        // Update thruster visuals
        updateThrusterVisuals(hasThrust && fuel > 0, input.boost, input.forward > 0);

        // Consume fuel
        fuel = Math.max(0, fuel - fuelUsed);

        return fuel;
    }

    // Update thruster particle effects and engine glows
    function updateThrusterVisuals(isThrusting, isBoosting, isForward) {
        const intensity = isBoosting ? 1.5 : (isThrusting ? 1.0 : 0);
        const flicker = 0.8 + Math.random() * 0.4;

        // Update particle systems
        thrusterParticles.forEach(particles => {
            if (isThrusting && isForward) {
                particles.emitRate = isBoosting ? 400 : 200;
                particles.minEmitPower = isBoosting ? 15 : 8;
                particles.maxEmitPower = isBoosting ? 25 : 15;
                particles.minSize = isBoosting ? 0.5 : 0.3;
                particles.maxSize = isBoosting ? 1.2 : 0.8;
            } else {
                particles.emitRate = 0;
            }
        });

        // Update engine glows
        engineGlows.forEach(glow => {
            if (isThrusting && isForward) {
                glow.innerMat.alpha = 0.9 * intensity * flicker;
                glow.outerMat.alpha = 0.6 * intensity * flicker;

                // Scale based on thrust
                const scale = isBoosting ? 1.5 : 1.0;
                glow.inner.scaling.set(scale, scale, scale * 1.5);
                glow.outer.scaling.set(scale, scale, scale * 1.5);
            } else {
                glow.innerMat.alpha = 0;
                glow.outerMat.alpha = 0;
            }
        });
    }

    // Set initial position for level
    function setPosition(position, rotation) {
        if (!mesh) return;

        mesh.position = position.clone();
        mesh.rotation = rotation ? rotation.clone() : new BABYLON.Vector3(0, 0, 0);
    }

    // Reset for new level
    function reset(levelFuel) {
        maxFuel = levelFuel;
        fuel = levelFuel;

        if (mesh) {
            mesh.position = new BABYLON.Vector3(0, 0, 0);
            mesh.rotation = new BABYLON.Vector3(0, 0, 0);
        }

        // Reset thruster visuals
        updateThrusterVisuals(false, false, false);

        SpaceDockingPhysics.reset(BABYLON);
    }

    // Get current fuel percentage
    function getFuelPercent() {
        return (fuel / maxFuel) * 100;
    }

    // Dispose of player mesh
    function dispose() {
        thrusterParticles.forEach(p => p.dispose());
        thrusterParticles = [];

        engineGlows.forEach(glow => {
            glow.inner.dispose();
            glow.outer.dispose();
        });
        engineGlows = [];

        if (mesh) {
            mesh.dispose();
            mesh = null;
        }
    }

    // Update thruster color based on theme
    function setThrusterColor(color) {
        thrusterParticles.forEach(particles => {
            particles.color1 = new BABYLON.Color4(1, color.g * 0.8 + 0.2, color.b * 0.3, 1);
            particles.color2 = new BABYLON.Color4(1, color.g * 0.4, color.b * 0.1, 1);
        });

        engineGlows.forEach(glow => {
            glow.innerMat.emissiveColor = new BABYLON.Color3(1, color.g * 0.6 + 0.2, color.b * 0.2);
            glow.outerMat.emissiveColor = new BABYLON.Color3(1, color.g * 0.4, color.b * 0.1);
        });
    }

    // Auto-align to target (for hint button)
    function alignToTarget(targetPosition, targetRotation) {
        if (!mesh || !targetPosition) return;

        // Calculate direction to target
        const direction = targetPosition.subtract(mesh.position).normalize();

        // Calculate rotation to face the target
        const yaw = Math.atan2(direction.x, direction.z);
        const pitch = -Math.asin(direction.y);

        // Set rotation to face target
        mesh.rotation.y = yaw;
        mesh.rotation.x = pitch;
        mesh.rotation.z = 0;

        // Stop all movement
        SpaceDockingPhysics.reset(BABYLON);
    }

    return {
        create,
        update,
        setPosition,
        reset,
        getFuelPercent,
        dispose,
        setThrusterColor,
        alignToTarget,
        setShipType,
        setShipColor,
        setBoostColor,
        getShipTypes: () => Object.keys(shipBuilders),
        get mesh() { return mesh; },
        get fuel() { return fuel; },
        get currentShipType() { return currentShipType; },
        get currentShipColor() { return currentShipColor; },
        get currentBoostColor() { return currentBoostColor; }
    };
})();

// Make globally accessible
window.SpaceDockingPlayer = SpaceDockingPlayer;
