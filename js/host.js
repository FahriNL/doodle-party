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
let lastKnownAspectRatio = null;

// Predefined Themes for Battle Mode
// Predefined Themes for Battle Mode in Indonesian
const themes = [
    "Kucing naik skateboard",
    "Pizza paling sedih di dunia",
    "Pahlawan super dengan kekuatan tidak berguna",
    "Pesta disko di bawah laut",
    "Pemanggang roti berhantu",
    "Koloni Mars tahun 2077",
    "Hari pertama dinosaurus di sekolah",
    "Kentang yang sangat kaya",
    "Turis alien di pantai",
    "Awan yang terkejut",
    "Robot belajar menari",
    "Penguin dalam rapat bisnis",
    "Tornado spageti",
    "Siput penjelajah waktu",
    "Paus di luar angkasa"
];

function initHost() {
    doodleCanvas = new DoodleCanvas('host-canvas');
    
    // Create random ID for the room
    const roomId = 'DOODLE-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    document.getElementById('room-code').innerText = `ID RUANGAN: ${roomId}`;

    peer = new Peer(roomId);

    // Generate QR code immediately with the roomId (don't wait for PeerJS open)
    generateQRCode(roomId);

    peer.on('open', (id) => {
        console.log('Room opened with ID:', id);
        // Mark status as connected
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.innerText = '🟢 Terhubung';
            statusEl.style.color = 'var(--success)';
        }
    });

    peer.on('connection', (conn) => {
        setupHostConnection(conn);
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.innerText = '🔴 Kesalahan Koneksi';
            statusEl.style.color = 'var(--danger)';
        }
    });
}

function generateQRCode(roomId) {
    const url = `${window.location.origin}${window.location.pathname.replace('index.html', '')}mobile.html#${roomId}`;
    
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = ''; // Clear existing QR code to prevent duplication
    
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
    linkEl.textContent = 'Buka tautan gabung ↗';
    linkEl.style.cssText = 'display:block; margin-top:0.75rem; color:var(--accent-primary); font-size:0.85rem; text-decoration:underline;';
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
            // Track aspect ratio from the first stroke for guide drawing
            if (data.stroke.aspectRatio && !lastKnownAspectRatio) {
                lastKnownAspectRatio = data.stroke.aspectRatio;
            }
            doodleCanvas.drawStroke(data.stroke);
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
    const names = Object.values(players).map(p => p.name);
    
    const playerCountEl = document.getElementById('player-count');
    if (count === 0) {
        playerCountEl.innerHTML = `<span style="color: var(--text-muted);">Menunggu pemain... (0)</span>`;
    } else {
        playerCountEl.innerHTML = `<span style="color: var(--success);">🎮 ${count} pemain bersiap!</span><br><small style="color: var(--text-muted);">${names.join(', ')}</small>`;
    }
    
    document.getElementById('active-players').innerText = `Pemain: ${count}`;
}

function startGame(mode) {
    currentMode = mode;
    lastKnownAspectRatio = null;
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
    document.getElementById('battle-theme').innerText = `🎨 Tema: ${theme}`;
    document.getElementById('battle-header').classList.remove('hidden');
    
    const selectedTime = parseInt(document.getElementById('battle-time-select').value) || 180;
    broadcast({ type: 'BATTLE_INFO', theme: theme, time: selectedTime });

    let timeLeft = selectedTime;
    document.getElementById('game-timer').innerText = formatTime(timeLeft);
    
    battleTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('game-timer').innerText = formatTime(timeLeft);
        
        // Color warning when time is low
        const timerEl = document.getElementById('game-timer');
        if (timeLeft <= 30) {
            timerEl.style.color = 'var(--danger)';
            timerEl.style.animation = 'pulse 0.5s infinite';
        } else if (timeLeft <= 60) {
            timerEl.style.color = '#f59e0b';
        }
        
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
        document.getElementById('reveal-title').innerText = `Gambar oleh: ???`;
        document.getElementById('reveal-counter').innerText = `${i + 1} / ${doodles.length}`;
        
        broadcast({ type: 'START_VOTING' });
        updateVotingStatus();

        // Wait for all votes or timeout
        await waitForVotes();
        
        // Calculate and save score
        const totalScore = Object.values(votes).reduce((a, b) => a + b, 0);
        players[doodle.playerId].score += totalScore;

        document.getElementById('reveal-title').innerText = `🎨 ${doodle.name} — Skor: ${totalScore}`;
        await new Promise(r => setTimeout(r, 3000)); // Show name for 3 seconds
    }

    showFinalResults();
}

function waitForVotes() {
    return new Promise(resolve => {
        const check = setInterval(() => {
            const voteCount = Object.keys(votes).length;
            const playerCount = Object.keys(players).length;
            if (voteCount >= playerCount && playerCount > 0) {
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
    document.getElementById('voting-status').innerText = `Menunggu suara... (${voteCount}/${playerCount})`;
}

function showFinalResults() {
    document.getElementById('reveal-screen').classList.add('hidden');
    document.getElementById('winner-screen').classList.remove('hidden');
    
    const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
    
    let leaderboardHTML = '';
    sortedPlayers.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        const isWinner = i === 0;
        leaderboardHTML += `
            <div class="leaderboard-row ${isWinner ? 'winner-row' : ''}" style="animation-delay: ${i * 0.2}s;">
                <span class="medal">${medal}</span>
                <span class="player-name">${p.name}</span>
                <span class="player-score">${p.score} pts</span>
            </div>
        `;
    });

    document.getElementById('winner-display').innerHTML = leaderboardHTML;
    
    const winner = sortedPlayers[0];
    broadcast({ type: 'GAME_OVER', winner: winner ? winner.name : 'Tidak ada', score: winner ? winner.score : 0 });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Initial Kickoff
window.onload = initHost;
