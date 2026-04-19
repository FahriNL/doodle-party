/**
 * Client Logic for Doodle Party (Mobile Controller)
 * Enhanced with undo, opacity, expanded colors/brushes, and aspect ratio data
 */

let peer;
let conn;
let doodleCanvas;
let currentMode = 'lobby';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = 'black';
let brushSize = 5;
let currentOpacity = 1.0;
let isEraser = false;

// Undo system — each "undo unit" is a full pen-down → pen-up gesture
let strokeHistory = [];   // Array of arrays: each sub-array = one gesture
let currentGesture = [];  // Strokes in the current pen-down

function initClient() {
    doodleCanvas = new DoodleCanvas('mobile-canvas');
    setupDrawingEvents();
    setupToolbar();
    
    // Check if room ID is in URL hash
    const roomId = window.location.hash.substring(1);
    if (!roomId) {
        alert("No Room ID found! Please scan the QR code on the PC screen.");
        return;
    }
}

function joinGame() {
    const playerName = document.getElementById('player-name').value || "Artist " + Math.floor(Math.random() * 100);
    const roomId = window.location.hash.substring(1);

    peer = new Peer();

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        conn = peer.connect(roomId);
        setupClientConnection(playerName);
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        alert('Connection error. Is the Room ID correct?');
    });
}

function setupClientConnection(name) {
    conn.on('open', () => {
        console.log('Connected to host');
        conn.send({ type: 'JOIN', name: name });

        conn.on('data', (data) => {
            handleHostData(data);
        });
    });

    conn.on('close', () => {
        alert('Lost connection to host.');
        location.reload();
    });
}

function handleHostData(data) {
    switch(data.type) {
        case 'JOIN_SUCCESS':
            switchScreen('waiting-screen');
            document.getElementById('waiting-message').innerText = "Waiting for the host to start the game...";
            break;

        case 'START_GAME':
            currentMode = data.mode;
            document.getElementById('current-mode').innerText = data.mode.toUpperCase();
            switchScreen('drawing-screen');
            doodleCanvas.clear();
            doodleCanvas.resize();
            strokeHistory = [];
            currentGesture = [];

            // Show/hide undo based on mode
            const undoBtn = document.getElementById('undo-btn');
            if (undoBtn) {
                undoBtn.style.display = (data.mode === 'battle') ? 'flex' : 'none';
            }
            break;

        case 'BATTLE_INFO':
            // Show theme in the status bar instead of alert
            const statusMode = document.getElementById('current-mode');
            statusMode.innerText = 'BATTLE';
            const themeDisplay = document.getElementById('battle-theme-display');
            if (themeDisplay) {
                themeDisplay.innerText = data.theme;
                themeDisplay.style.display = 'block';
            }
            const timerDisplay = document.getElementById('mobile-timer');
            if (timerDisplay) {
                let timeLeft = data.time;
                timerDisplay.innerText = formatTime(timeLeft);
                timerDisplay.style.display = 'block';
                const timerInterval = setInterval(() => {
                    timeLeft--;
                    timerDisplay.innerText = formatTime(timeLeft);
                    if (timeLeft <= 0) {
                        clearInterval(timerInterval);
                    }
                }, 1000);
            }
            break;

        case 'TIME_UP':
            if (currentMode === 'battle') {
                const imageData = doodleCanvas.getImageData();
                conn.send({ type: 'SUBMIT_DOODLE', image: imageData });
                switchScreen('waiting-screen');
                document.getElementById('waiting-message').innerText = "Doodle submitted! Waiting for others...";
            }
            break;

        case 'START_VOTING':
            switchScreen('voting-screen');
            break;

        case 'GAME_OVER':
            switchScreen('waiting-screen');
            document.getElementById('waiting-message').innerHTML = `<h3>Game Over!</h3><p>Winner: ${data.winner}</p>`;
            break;
    }
}

function getCanvasAspectRatio() {
    const canvas = document.getElementById('mobile-canvas');
    return canvas.height / canvas.width;
}

function setupDrawingEvents() {
    const canvas = document.getElementById('mobile-canvas');

    const start = (e) => {
        isDrawing = true;
        currentGesture = [];
        const pos = getPos(e);
        lastX = pos.x / canvas.width;
        lastY = pos.y / canvas.height;
    };

    const move = (e) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        const currX = pos.x / canvas.width;
        const currY = pos.y / canvas.height;

        const stroke = {
            x1: lastX,
            y1: lastY,
            x2: currX,
            y2: currY,
            color: isEraser ? 'white' : currentColor,
            size: brushSize,
            opacity: isEraser ? 1.0 : currentOpacity,
            aspectRatio: getCanvasAspectRatio()
        };

        // Draw locally
        doodleCanvas.drawStroke(stroke);

        // Save for undo (battle mode)
        if (currentMode === 'battle') {
            currentGesture.push(stroke);
        }

        // Send to host if in freeplay
        if (currentMode === 'freeplay' && conn && conn.open) {
            conn.send({ type: 'DRAW', stroke: stroke });
        }

        lastX = currX;
        lastY = currY;
        e.preventDefault();
    };

    const stop = () => {
        if (isDrawing && currentGesture.length > 0) {
            strokeHistory.push([...currentGesture]);
            currentGesture = [];
        }
        isDrawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
}

function getPos(e) {
    const canvas = document.getElementById('mobile-canvas');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

// ============== Tool functions ==============

function setupToolbar() {
    // Color picker logic
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            currentColor = swatch.dataset.color;
            isEraser = false;
            document.getElementById('eraser-btn').classList.remove('active');
        });
    });

    // Brush size buttons
    document.querySelectorAll('.brush-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            brushSize = parseInt(btn.dataset.size);
        });
    });

    // Opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            currentOpacity = parseFloat(e.target.value);
            const label = document.getElementById('opacity-label');
            if (label) label.innerText = Math.round(currentOpacity * 100) + '%';
        });
    }
}

function setBrush(size) {
    brushSize = size;
    document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
    const target = document.querySelector(`.brush-btn[data-size="${size}"]`);
    if (target) target.classList.add('active');
}

function toggleEraser() {
    isEraser = !isEraser;
    document.getElementById('eraser-btn').classList.toggle('active', isEraser);
}

function clearCanvas() {
    doodleCanvas.clear();
    strokeHistory = [];
    currentGesture = [];
}

function undoLastStroke() {
    if (strokeHistory.length === 0) return;
    strokeHistory.pop();
    // Replay all remaining strokes
    doodleCanvas.clear();
    for (const gesture of strokeHistory) {
        for (const stroke of gesture) {
            doodleCanvas.drawStroke(stroke);
        }
    }
}

function sendVote(val) {
    if (conn && conn.open) {
        conn.send({ type: 'VOTE', value: val });
        switchScreen('waiting-screen');
        document.getElementById('waiting-message').innerText = "Vote sent! Waiting for results...";
    }
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

window.onload = initClient;
