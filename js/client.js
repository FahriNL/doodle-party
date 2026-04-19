/**
 * Client Logic for Doodle Party (Mobile Controller)
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
let isEraser = false;

function initClient() {
    doodleCanvas = new DoodleCanvas('mobile-canvas');
    setupDrawingEvents();
    
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
            break;

        case 'BATTLE_INFO':
            alert("BATTLE START! \nTheme: " + data.theme);
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

function setupDrawingEvents() {
    const canvas = document.getElementById('mobile-canvas');

    const start = (e) => {
        isDrawing = true;
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
            size: brushSize
        };

        // Draw locally
        doodleCanvas.drawStroke(stroke);

        // Send to host if in freeplay
        if (currentMode === 'freeplay' && conn && conn.open) {
            conn.send({ type: 'DRAW', stroke: stroke });
        }

        lastX = currX;
        lastY = currY;
        e.preventDefault();
    };

    const stop = () => { isDrawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);

    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', move);
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

// Tool functions
function setBrush(size) {
    brushSize = size;
}

function toggleEraser() {
    isEraser = !isEraser;
    document.getElementById('eraser-btn').classList.toggle('active', isEraser);
}

function clearCanvas() {
    doodleCanvas.clear();
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

window.onload = initClient;
