/**
 * Space Docking Game - Physics System
 * Handles movement, collision, and soft-docking mechanics
 */

const SpaceDockingPhysics = (() => {
    // Physics constants - realistic space movement
    const DRAG = 1.0; // No friction in space - objects stay in motion
    const ROTATION_DRAG = 0.92; // Slight rotation damping for playability
    const MAX_VELOCITY = 5.0; // Higher max speed since no friction
    const MAX_ANGULAR_VELOCITY = 0.05;

    // Docking constants - balanced for playability
    // ADJUSTABLE: Increase SOFT_DOCK_RANGE for earlier magnetic assistance
    const SOFT_DOCK_RANGE = 15; // Start magnetic pull when approaching
    // ADJUSTABLE: Increase DOCK_COMPLETE_RANGE for easier docking
    const DOCK_COMPLETE_RANGE = 5; // Need to get reasonably close to complete dock
    // ADJUSTABLE: Increase MAGNETIC_STRENGTH for stronger pull toward dock
    const MAGNETIC_STRENGTH = 0.008; // Gentle pull - assists but player stays in control
    // ADJUSTABLE: Increase ALIGN_STRENGTH for faster auto-alignment
    const ALIGN_STRENGTH = 0.015; // Gradual alignment help
    // ADJUSTABLE: Increase GRACE_PERIOD_SECONDS for longer immunity at start
    const GRACE_PERIOD_SECONDS = 2.0; // Seconds before docking assistance kicks in
    // ADJUSTABLE: Decrease DOCK_HOLD_TIME for faster docking confirmation
    const DOCK_HOLD_TIME = 0.8; // Seconds to hold in dock zone to complete
    // ADJUSTABLE: Increase RING_PASS_TOLERANCE for easier ring pass-through
    const RING_PASS_TOLERANCE = 6; // Distance tolerance for ring pass-through

    // State
    let velocity = null;
    let angularVelocity = null;
    let isDocking = false;
    let dockProgress = 0;
    let gracePeriodRemaining = GRACE_PERIOD_SECONDS;
    let dockHoldTimer = 0;
    let wasInDockZone = false;
    let passedThroughRing = false;

    // Initialize vectors
    function init(BABYLON) {
        velocity = new BABYLON.Vector3(0, 0, 0);
        angularVelocity = new BABYLON.Vector3(0, 0, 0);
        isDocking = false;
        dockProgress = 0;
    }

    // Reset physics state
    function reset(BABYLON) {
        if (velocity) {
            velocity.set(0, 0, 0);
        } else {
            velocity = new BABYLON.Vector3(0, 0, 0);
        }
        if (angularVelocity) {
            angularVelocity.set(0, 0, 0);
        } else {
            angularVelocity = new BABYLON.Vector3(0, 0, 0);
        }
        isDocking = false;
        dockProgress = 0;
        gracePeriodRemaining = GRACE_PERIOD_SECONDS;
        dockHoldTimer = 0;
        wasInDockZone = false;
        passedThroughRing = false;
    }

    // Apply thrust force
    function applyThrust(direction, force, playerMesh) {
        if (!velocity || !playerMesh) return;

        // Transform direction to world space based on ship orientation
        const worldDir = BABYLON.Vector3.TransformNormal(
            direction,
            playerMesh.getWorldMatrix()
        );

        velocity.addInPlace(worldDir.scale(force));

        // Clamp velocity
        if (velocity.length() > MAX_VELOCITY) {
            velocity.normalize().scaleInPlace(MAX_VELOCITY);
        }
    }

    // Apply rotation torque
    function applyTorque(axis, force) {
        if (!angularVelocity) return;

        angularVelocity.addInPlace(axis.scale(force));

        // Clamp angular velocity
        if (angularVelocity.length() > MAX_ANGULAR_VELOCITY) {
            angularVelocity.normalize().scaleInPlace(MAX_ANGULAR_VELOCITY);
        }
    }

    // Update physics simulation
    function update(playerMesh, dockingPort, levelConfig, deltaTime = 0.016) {
        if (!velocity || !playerMesh) return { docked: false, collision: false };

        // Update grace period
        if (gracePeriodRemaining > 0) {
            gracePeriodRemaining -= deltaTime;
        }

        // Apply velocity
        playerMesh.position.addInPlace(velocity);

        // Apply rotation
        if (angularVelocity) {
            playerMesh.rotation.addInPlace(angularVelocity);
        }

        // Apply drag
        velocity.scaleInPlace(DRAG);
        if (angularVelocity) {
            angularVelocity.scaleInPlace(ROTATION_DRAG);
        }

        // Check docking if we have a docking port
        if (dockingPort) {
            const dockResult = checkDocking(playerMesh, dockingPort, levelConfig, deltaTime);
            if (dockResult.docked) {
                return { docked: true, collision: false };
            }
        }

        return { docked: false, collision: false };
    }

    // Check and handle soft-docking
    function checkDocking(playerMesh, dockingPort, levelConfig, deltaTime = 0.016) {
        const dockTolerance = levelConfig?.dockTolerance || 4.0;
        const alignTolerance = levelConfig?.dockAlignTolerance || 0.4; // More forgiving

        // Get world position of docking port (it's parented to station)
        const dockWorldPos = dockingPort.getAbsolutePosition();

        // Get distance to docking port
        const distance = BABYLON.Vector3.Distance(
            playerMesh.position,
            dockWorldPos
        );

        // Calculate alignment (dot product of forward vectors)
        const playerForward = new BABYLON.Vector3(0, 0, 1);
        const worldPlayerForward = BABYLON.Vector3.TransformNormal(
            playerForward,
            playerMesh.getWorldMatrix()
        );

        const dockForward = new BABYLON.Vector3(0, 0, -1);
        const worldDockForward = BABYLON.Vector3.TransformNormal(
            dockForward,
            dockingPort.getWorldMatrix()
        );

        const alignment = BABYLON.Vector3.Dot(
            worldPlayerForward.normalize(),
            worldDockForward.normalize()
        );

        // Alignment ranges from -1 (opposite) to 1 (aligned)
        const alignmentScore = (alignment + 1) / 2; // Normalize to 0-1

        // Track ring pass-through: if we were outside and are now inside the ring zone
        const inRingZone = distance < RING_PASS_TOLERANCE;
        if (!wasInDockZone && inRingZone) {
            passedThroughRing = true;
        }
        wasInDockZone = inRingZone;

        // Don't apply magnetic assistance during grace period
        if (gracePeriodRemaining > 0) {
            isDocking = false;
            return { docked: false, distance, alignment: alignmentScore, holdProgress: 0 };
        }

        // Check if within soft-dock range
        if (distance < SOFT_DOCK_RANGE) {
            isDocking = true;

            // Apply magnetic pull toward docking port (gentler than before)
            const pullDirection = dockWorldPos.subtract(playerMesh.position).normalize();
            const pullStrength = MAGNETIC_STRENGTH * (1 - distance / SOFT_DOCK_RANGE);
            velocity.addInPlace(pullDirection.scale(pullStrength));

            // Apply alignment assistance - only when reasonably aligned already
            if (alignmentScore > 0.4) { // More forgiving threshold
                // Gradually align to docking port orientation
                const targetRotation = dockingPort.rotation.clone();
                targetRotation.y += Math.PI; // Face opposite direction

                // Slightly stronger alignment as you get closer
                const proximityBonus = 1 + (1 - distance / SOFT_DOCK_RANGE) * 0.5;
                const effectiveStrength = ALIGN_STRENGTH * proximityBonus;

                playerMesh.rotation.x += (targetRotation.x - playerMesh.rotation.x) * effectiveStrength;
                playerMesh.rotation.y += (targetRotation.y - playerMesh.rotation.y) * effectiveStrength;
                playerMesh.rotation.z += (targetRotation.z - playerMesh.rotation.z) * effectiveStrength;
            }

            // Check docking conditions: either pass through ring OR be close enough with alignment
            const alignmentThreshold = 1 - alignTolerance;
            const inDockZone = distance < DOCK_COMPLETE_RANGE && alignmentScore > alignmentThreshold;

            // If in dock zone, increment hold timer
            if (inDockZone || (passedThroughRing && distance < RING_PASS_TOLERANCE)) {
                dockHoldTimer += deltaTime;
                dockProgress = Math.min(1, dockHoldTimer / DOCK_HOLD_TIME);

                // Complete docking after holding for required time
                if (dockHoldTimer >= DOCK_HOLD_TIME) {
                    return { docked: true, distance, alignment: alignmentScore, holdProgress: 1 };
                }
            } else {
                // Reset hold timer if not in dock zone
                dockHoldTimer = Math.max(0, dockHoldTimer - deltaTime * 2); // Decay faster than accumulate
                dockProgress = Math.min(1, dockHoldTimer / DOCK_HOLD_TIME);
            }
        } else {
            isDocking = false;
            // Slowly reset hold timer when far away
            dockHoldTimer = Math.max(0, dockHoldTimer - deltaTime);
            dockProgress = Math.min(1, dockHoldTimer / DOCK_HOLD_TIME);
        }

        return { docked: false, distance, alignment: alignmentScore, holdProgress: dockProgress };
    }

    // Check collision with obstacle
    function checkCollision(playerMesh, obstacle, collisionRadius = 3) {
        if (!playerMesh || !obstacle) return false;

        const distance = BABYLON.Vector3.Distance(
            playerMesh.position,
            obstacle.position
        );

        // Simple sphere collision
        const playerRadius = 2;
        const obstacleRadius = obstacle.scaling ?
            Math.max(obstacle.scaling.x, obstacle.scaling.y, obstacle.scaling.z) * collisionRadius :
            collisionRadius;

        return distance < (playerRadius + obstacleRadius);
    }

    // Check collisions with array of obstacles
    function checkCollisions(playerMesh, obstacles) {
        if (!playerMesh || !obstacles) return false;

        for (const obstacle of obstacles) {
            if (obstacle.isDisposed && obstacle.isDisposed()) continue;

            const radius = obstacle.metadata?.collisionRadius || 3;
            if (checkCollision(playerMesh, obstacle, radius)) {
                return true;
            }
        }
        return false;
    }

    // Get docking info for HUD
    function getDockingInfo(playerMesh, dockingPort) {
        if (!playerMesh || !dockingPort) {
            return { distance: Infinity, alignment: 0, isDocking: false };
        }

        // Get world position of docking port
        const dockWorldPos = dockingPort.getAbsolutePosition();

        const distance = BABYLON.Vector3.Distance(
            playerMesh.position,
            dockWorldPos
        );

        // Calculate alignment
        const playerForward = new BABYLON.Vector3(0, 0, 1);
        const worldPlayerForward = BABYLON.Vector3.TransformNormal(
            playerForward,
            playerMesh.getWorldMatrix()
        );

        const dockForward = new BABYLON.Vector3(0, 0, -1);
        const worldDockForward = BABYLON.Vector3.TransformNormal(
            dockForward,
            dockingPort.getWorldMatrix()
        );

        const alignment = BABYLON.Vector3.Dot(
            worldPlayerForward.normalize(),
            worldDockForward.normalize()
        );

        const alignmentScore = Math.max(0, (alignment + 1) / 2);

        return {
            distance: distance,
            alignment: alignmentScore,
            isDocking: distance < SOFT_DOCK_RANGE
        };
    }

    // Get current velocity magnitude
    function getSpeed() {
        return velocity ? velocity.length() : 0;
    }

    return {
        init,
        reset,
        applyThrust,
        applyTorque,
        update,
        checkDocking,
        checkCollision,
        checkCollisions,
        getDockingInfo,
        getSpeed,
        get isDocking() { return isDocking; },
        get velocity() { return velocity; },
        SOFT_DOCK_RANGE,
        DOCK_COMPLETE_RANGE
    };
})();
