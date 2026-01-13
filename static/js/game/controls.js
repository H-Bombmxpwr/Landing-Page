/**
 * Space Docking Game - Controls System
 * Handles keyboard, mouse, and touch input
 */

const SpaceDockingControls = (() => {
    // Input state
    const keys = {};
    let mouseMovement = { x: 0, y: 0 };
    let mouseLocked = false;

    // Touch joystick state
    const joysticks = {
        left: { active: false, x: 0, y: 0 },
        right: { active: false, x: 0, y: 0 }
    };
    let touchBoost = false;

    // Settings
    let settings = {
        mouseSensitivity: 1.0,
        invertY: false,
        invertForwardBack: false,  // Invert W/S
        invertStrafe: false,       // Invert A/D
        touchSensitivity: 1.0
    };

    // DOM elements
    let canvas = null;
    let leftJoystick = null;
    let rightJoystick = null;
    let boostBtn = null;

    // Track touch identifiers
    let leftTouchId = null;
    let rightTouchId = null;

    // Initialize controls
    function init(gameCanvas) {
        canvas = gameCanvas;

        // Load settings
        const savedSettings = SpaceDockingLevels.getSettings();
        settings = { ...settings, ...savedSettings };

        setupKeyboard();
        setupMouse();
        setupTouch();
    }

    // Keyboard setup
    function setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;

            // Prevent default for game keys
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
                'Space', 'ShiftLeft', 'ControlLeft', 'Escape', 'KeyH'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });
    }

    // Mouse setup
    function setupMouse() {
        if (!canvas) return;

        canvas.addEventListener('click', () => {
            if (!mouseLocked) {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            mouseLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', (e) => {
            if (mouseLocked) {
                mouseMovement.x += e.movementX * settings.mouseSensitivity * 0.002;
                mouseMovement.y += e.movementY * settings.mouseSensitivity * 0.002 *
                    (settings.invertY ? -1 : 1);
            }
        });
    }

    // Touch setup
    function setupTouch() {
        leftJoystick = document.getElementById('joystick-left');
        rightJoystick = document.getElementById('joystick-right');
        boostBtn = document.getElementById('touch-boost');

        if (leftJoystick) {
            setupJoystick(leftJoystick, 'left');
        }

        if (rightJoystick) {
            setupJoystick(rightJoystick, 'right');
        }

        if (boostBtn) {
            boostBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                touchBoost = true;
            });

            boostBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                touchBoost = false;
            });
        }
    }

    function setupJoystick(element, side) {
        const stick = element.querySelector('.joystick-stick');
        const base = element.querySelector('.joystick-base');

        if (!stick || !base) return;

        const baseRect = () => base.getBoundingClientRect();
        const maxDistance = 35;

        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];

            if (side === 'left') {
                leftTouchId = touch.identifier;
            } else {
                rightTouchId = touch.identifier;
            }

            joysticks[side].active = true;
            updateJoystick(touch, side, stick, baseRect(), maxDistance);
        });

        element.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touchId = side === 'left' ? leftTouchId : rightTouchId;

            for (const touch of e.changedTouches) {
                if (touch.identifier === touchId) {
                    updateJoystick(touch, side, stick, baseRect(), maxDistance);
                    break;
                }
            }
        });

        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchId = side === 'left' ? leftTouchId : rightTouchId;

            for (const touch of e.changedTouches) {
                if (touch.identifier === touchId) {
                    joysticks[side].active = false;
                    joysticks[side].x = 0;
                    joysticks[side].y = 0;
                    stick.style.transform = 'translate(-50%, -50%)';

                    if (side === 'left') {
                        leftTouchId = null;
                    } else {
                        rightTouchId = null;
                    }
                    break;
                }
            }
        });

        element.addEventListener('touchcancel', (e) => {
            joysticks[side].active = false;
            joysticks[side].x = 0;
            joysticks[side].y = 0;
            stick.style.transform = 'translate(-50%, -50%)';

            if (side === 'left') {
                leftTouchId = null;
            } else {
                rightTouchId = null;
            }
        });
    }

    function updateJoystick(touch, side, stick, rect, maxDistance) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;

        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxDistance) {
            dx = (dx / distance) * maxDistance;
            dy = (dy / distance) * maxDistance;
        }

        // Normalize to -1 to 1
        joysticks[side].x = dx / maxDistance;
        joysticks[side].y = dy / maxDistance;

        // Update visual
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    // Get current input state
    function getInput() {
        const input = {
            // Movement (translation)
            forward: 0,
            right: 0,
            up: 0,

            // Rotation
            pitch: 0,
            yaw: 0,
            roll: 0,

            // Boost
            boost: false,

            // Hint (auto-align)
            hint: false
        };

        // Forward/Back with optional invert
        const forwardMult = settings.invertForwardBack ? -1 : 1;
        if (keys['KeyW']) input.forward += 1 * forwardMult;
        if (keys['KeyS']) input.forward -= 1 * forwardMult;

        // Strafe with optional invert
        const strafeMult = settings.invertStrafe ? -1 : 1;
        if (keys['KeyA']) input.right -= 1 * strafeMult;
        if (keys['KeyD']) input.right += 1 * strafeMult;

        // Up/Down
        if (keys['ShiftLeft'] || keys['ShiftRight']) input.up += 1;
        if (keys['ControlLeft'] || keys['ControlRight']) input.up -= 1;

        // Roll
        if (keys['KeyQ']) input.roll -= 1;
        if (keys['KeyE']) input.roll += 1;

        // Boost
        if (keys['Space']) input.boost = true;

        // Hint (H key)
        if (keys['KeyH']) input.hint = true;

        // Mouse input for rotation
        input.yaw += mouseMovement.x;
        input.pitch += mouseMovement.y;

        // Reset mouse movement after reading
        mouseMovement.x = 0;
        mouseMovement.y = 0;

        // Touch input
        if (joysticks.left.active) {
            input.right += joysticks.left.x * settings.touchSensitivity * strafeMult;
            input.forward -= joysticks.left.y * settings.touchSensitivity * forwardMult;
        }

        if (joysticks.right.active) {
            input.yaw += joysticks.right.x * 0.05 * settings.touchSensitivity;
            input.pitch += joysticks.right.y * 0.05 * settings.touchSensitivity;
        }

        if (touchBoost) {
            input.boost = true;
        }

        return input;
    }

    // Check if specific key is pressed
    function isKeyPressed(code) {
        return !!keys[code];
    }

    // Release pointer lock
    function releasePointerLock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        mouseLocked = false;
    }

    // Update settings
    function updateSettings(newSettings) {
        settings = { ...settings, ...newSettings };
        SpaceDockingLevels.updateSettings(settings);
    }

    // Clear all input state
    function reset() {
        for (const key in keys) {
            keys[key] = false;
        }
        mouseMovement.x = 0;
        mouseMovement.y = 0;
        joysticks.left.active = false;
        joysticks.left.x = 0;
        joysticks.left.y = 0;
        joysticks.right.active = false;
        joysticks.right.x = 0;
        joysticks.right.y = 0;
        touchBoost = false;
    }

    // Check if using touch
    function isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    return {
        init,
        getInput,
        isKeyPressed,
        releasePointerLock,
        updateSettings,
        reset,
        isTouchDevice,
        get isMouseLocked() { return mouseLocked; },
        get settings() { return settings; }
    };
})();
