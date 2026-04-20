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
let currentBrushType = 'marker'; // New
let currentOpacity = 1.0;
let isEraser = false;

// Undo system
let strokeHistory = [];   // Array of { gestureId, strokes: [] }
let currentGesture = [];  // Strokes in the current pen-down
let currentGestureId = null;

function initClient() {
    doodleCanvas = new DoodleCanvas('mobile-canvas');
    setupDrawingEvents();
    setupToolbar();
    
    // Check if room ID is in URL hash
    const roomId = window.location.hash.substring(1);
    if (!roomId) {
        alert("ID Ruangan tidak ditemukan! Silakan pindai kode QR di layar PC.");
        return;
    }
}

function joinGame() {
    const playerName = document.getElementById('player-name').value || "Seniman " + Math.floor(Math.random() * 100);
    const roomId = window.location.hash.substring(1);

    peer = new Peer();

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        conn = peer.connect(roomId);
        setupClientConnection(playerName);
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        alert('Kesalahan koneksi. Apakah ID Ruangan benar?');
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
        alert('Koneksi ke host terputus.');
        location.reload();
    });
}

function handleHostData(data) {
    switch(data.type) {
        case 'JOIN_SUCCESS':
            switchScreen('waiting-screen');
            document.getElementById('waiting-message').innerText = "Menunggu host untuk memulai permainan...";
            break;

        case 'START_GAME':
            currentMode = data.mode;
            document.getElementById('current-mode').innerText = data.mode === 'freeplay' ? 'MAIN BEBAS' : 'PERTARUNGAN';
            switchScreen('drawing-screen');
            doodleCanvas.clear();
            doodleCanvas.resize();
            strokeHistory = [];
            currentGesture = [];

            // Show/hide undo based on mode
            const undoBtn = document.getElementById('undo-btn');
            if (undoBtn) {
                undoBtn.style.display = 'flex'; // Undo is now always available
            }
            break;

        case 'BATTLE_INFO':
            // Show theme in the status bar instead of alert
            const statusMode = document.getElementById('current-mode');
            statusMode.innerText = 'PERTARUNGAN';
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
                document.getElementById('waiting-message').innerText = "Doodle dikirim! Menunggu pemain lain...";
            }
            break;

        case 'START_VOTING':
            switchScreen('voting-screen');
            break;

        case 'GAME_OVER':
            switchScreen('waiting-screen');
            document.getElementById('waiting-message').innerHTML = `<h3>Permainan Selesai!</h3><p>Pemenang: ${data.winner}</p>`;
            break;

        case 'DRAW':
            // Render strokes from other players (Sync)
            if (doodleCanvas) {
                doodleCanvas.drawStroke(data.stroke);
            }
            break;

        case 'CLEAR_CANVAS':
            if (doodleCanvas) {
                doodleCanvas.clear();
                // When we receive CLEAR_CANVAS in freeplay for host sync, we keep strokeHistory intact 
                // so we can still undo our own strokes later.
            }
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
        currentGestureId = Date.now().toString() + Math.random().toString().substr(2, 5);
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
            brushType: isEraser ? 'marker' : currentBrushType, // Added
            opacity: isEraser ? 1.0 : currentOpacity,
            aspectRatio: getCanvasAspectRatio()
        };

        // Draw locally
        doodleCanvas.drawStroke(stroke);

        // Always save for undo
        currentGesture.push(stroke);

        // Send to host
        if (conn && conn.open) {
            conn.send({ type: 'DRAW', stroke: stroke, gestureId: currentGestureId });
        }

        lastX = currX;
        lastY = currY;
        e.preventDefault();
    };

    const stop = () => {
        if (isDrawing && currentGesture.length > 0) {
            strokeHistory.push({ gestureId: currentGestureId, strokes: [...currentGesture] });
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

    // Brush type buttons
    document.querySelectorAll('.brush-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.brush-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentBrushType = btn.dataset.type;
            isEraser = false;
            document.getElementById('eraser-btn').classList.remove('active');
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

function toggleEraser() {
    isEraser = !isEraser;
    document.getElementById('eraser-btn').classList.toggle('active', isEraser);
}

function clearCanvas() {
    doodleCanvas.clear();
    strokeHistory = [];
    currentGesture = [];
    if (conn && conn.open) conn.send({ type: 'CLEAR_MY_STROKES' });
}

function undoLastStroke() {
    if (strokeHistory.length === 0) return;
    const lastGestureObj = strokeHistory.pop();
    
    if (conn && conn.open) {
        conn.send({ type: 'UNDO', gestureId: lastGestureObj.gestureId });
    }

    // Replay remaining local strokes
    doodleCanvas.clear();
    for (const gestureObj of strokeHistory) {
        for (const stroke of gestureObj.strokes) {
            doodleCanvas.drawStroke(stroke);
        }
    }
}

function sendVote(val) {
    if (conn && conn.open) {
        conn.send({ type: 'VOTE', value: val });
        switchScreen('waiting-screen');
        document.getElementById('waiting-message').innerText = "Suara terkirim! Menunggu hasil...";
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
