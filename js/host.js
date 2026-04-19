/**
 * Host Logic for Doodle Party
 */

let peer;
let players = {};
let doodles = []; // For Battle mode
let votes = {};
let currentMode = 'lobby';
let doodleCanvas;
let battleTimer;

// Predefined Themes for Battle Mode
const themes = [
    "A cat riding a skateboard",
    "The world's saddest pizza",
    "A superhero with a useless power",
    "Undersea disco party",
    "A haunted toaster",
    "Mars colony in 2077",
    "Dinosaur's first day at school",
    "A very rich potato",
    "Alien tourist at a beach",
    "Surprised cloud"
];

function initHost() {
    doodleCanvas = new DoodleCanvas('host-canvas');
    
    // Create random ID for the room
    const roomId = 'DOODLE-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    document.getElementById('room-code').innerText = `ROOM ID: ${roomId}`;

    peer = new Peer(roomId);

    // Generate QR code immediately with the roomId (don't wait for PeerJS open)
    generateQRCode(roomId);

    peer.on('open', (id) => {
        console.log('Room opened with ID:', id);
    });

    peer.on('connection', (conn) => {
        setupHostConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        alert('Failed to connect to PeerServer. Please refresh.');
    });
}

function generateQRCode(roomId) {
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}mobile.html#${roomId}`;
    
    const qrContainer = document.getElementById("qrcode");
    
    try {
        new QRCode(qrContainer, {
            text: url,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    } catch (e) {
        console.error('QR Code generation failed:', e);
    }

    // Add a clickable link below the QR code as fallback
    const linkEl = document.createElement('a');
    linkEl.href = url;
    linkEl.target = '_blank';
    linkEl.textContent = 'Open join link';
    linkEl.style.cssText = 'display:block; margin-top:0.5rem; color:#8b5cf6; font-size:0.85rem; text-decoration:underline;';
    qrContainer.parentElement.insertBefore(linkEl, qrContainer.nextSibling);

    console.log("Join Link:", url);
}

function setupHostConnection(conn) {
    conn.on('open', () => {
        console.log('Player connected:', conn.peer);
        
        conn.on('data', (data) => {
            handleClientData(conn, data);
        });

        conn.on('close', () => {
            delete players[conn.peer];
            updatePlayerCount();
        });
    });
}

function handleClientData(conn, data) {
    switch(data.type) {
        case 'JOIN':
            players[conn.peer] = { 
                id: conn.peer, 
                name: data.name, 
                conn: conn,
                score: 0 
            };
            updatePlayerCount();
            // Tell client their join was successful
            conn.send({ type: 'JOIN_SUCCESS', mode: currentMode });
            break;

        case 'DRAW':
            if (currentMode === 'freeplay') {
                doodleCanvas.drawStroke(data.stroke);
            }
            break;

        case 'SUBMIT_DOODLE':
            if (currentMode === 'battle') {
                doodles.push({ playerId: conn.peer, name: players[conn.peer].name, image: data.image });
                checkAllDoodlesSubmitted();
            }
            break;

        case 'VOTE':
            votes[conn.peer] = data.value;
            updateVotingStatus();
            break;
    }
}

function updatePlayerCount() {
    const count = Object.keys(players).length;
    document.getElementById('player-count').innerText = `Ready to Party! (${count} players)`;
    document.getElementById('active-players').innerText = `Players: ${count}`;
}

function startGame(mode) {
    currentMode = mode;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Broadcast mode change to all clients
    broadcast({ type: 'START_GAME', mode: mode });

    if (mode === 'freeplay') {
        doodleCanvas.clear();
        document.getElementById('battle-header').classList.add('hidden');
    } else if (mode === 'battle') {
        startBattleMode();
    }
}

function startBattleMode() {
    doodles = [];
    votes = {};
    doodleCanvas.clear();
    
    const theme = themes[Math.floor(Math.random() * themes.length)];
    document.getElementById('battle-theme').innerText = `Theme: ${theme}`;
    document.getElementById('battle-header').classList.remove('hidden');
    
    const selectedTime = parseInt(document.getElementById('battle-time-select').value) || 180;
    broadcast({ type: 'BATTLE_INFO', theme: theme, time: selectedTime });

    let timeLeft = selectedTime;
    document.getElementById('game-timer').innerText = formatTime(timeLeft);
    
    battleTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('game-timer').innerText = formatTime(timeLeft);
        if (timeLeft <= 0) {
            clearInterval(battleTimer);
            broadcast({ type: 'TIME_UP' });
        }
    }, 1000);
}

function broadcast(data) {
    Object.values(players).forEach(p => p.conn.send(data));
}

function checkAllDoodlesSubmitted() {
    const playerCount = Object.keys(players).length;
    if (doodles.length >= playerCount) {
        clearInterval(battleTimer);
        startRevealProcess();
    }
}

async function startRevealProcess() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('reveal-screen').classList.remove('hidden');
    
    for (let i = 0; i < doodles.length; i++) {
        votes = {}; // Reset votes for each reveal
        const doodle = doodles[i];
        
        document.getElementById('reveal-image').src = doodle.image;
        document.getElementById('reveal-title').innerText = `Doodle by: ???`;
        
        broadcast({ type: 'START_VOTING' });
        updateVotingStatus();

        // Wait for all votes or 15 seconds
        await waitForVotes();
        
        // Calculate and save score
        const totalScore = Object.values(votes).reduce((a, b) => a + b, 0);
        const avgScore = totalScore / (Object.keys(players).length || 1);
        players[doodle.playerId].score += totalScore;

        document.getElementById('reveal-title').innerText = `Doodle by: ${doodle.name} (Score: ${totalScore})`;
        await new Promise(r => setTimeout(r, 3000)); // Show name for 3 seconds
    }

    showFinalResults();
}

function waitForVotes() {
    return new Promise(resolve => {
        const check = setInterval(() => {
            const voteCount = Object.keys(votes).length;
            const playerCount = Object.keys(players).length;
            if (voteCount >= playerCount && playerCount > 0) { // Everyone voted
                clearInterval(check);
                resolve();
            }
        }, 500);
        
        // Timeout after 20 secs
        setTimeout(() => { clearInterval(check); resolve(); }, 20000);
    });
}

function updateVotingStatus() {
    const voteCount = Object.keys(votes).length;
    const playerCount = Object.keys(players).length;
    document.getElementById('voting-status').innerText = `Waiting for votes... (${voteCount}/${playerCount})`;
}

function showFinalResults() {
    document.getElementById('reveal-screen').classList.add('hidden');
    document.getElementById('winner-screen').classList.remove('hidden');
    
    const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    document.getElementById('winner-display').innerHTML = `
        <h2 style="font-size: 3rem; margin-bottom: 1rem;">${winner ? winner.name : 'No one'}</h2>
        <p style="font-size: 1.5rem;">With a total of ${winner ? winner.score : 0} points!</p>
    `;
    
    broadcast({ type: 'GAME_OVER', winner: winner ? winner.name : 'No one', score: winner ? winner.score : 0 });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Initial Kickoff
window.onload = initHost;
