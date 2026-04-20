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
            document.getElementById('status-text').innerText = 'Terhubung';
            document.getElementById('status-icon').innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
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
            document.getElementById('status-text').innerText = 'Kesalahan Koneksi';
            document.getElementById('status-icon').innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
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
            // Only draw and broadcast if in freeplay mode. In battle mode, host canvas should not reveal strokes.
            if (currentMode === 'freeplay') {
                doodleCanvas.drawStroke(data.stroke);
                broadcast(data);
            }
            break;

        case 'SUBMIT_DOODLE':
            if (currentMode === 'battle') {
                doodles.push({ playerId: conn.peer, name: players[conn.peer].name, image: data.image });
                updateBattlePlayerStatus();
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
        playerCountEl.innerHTML = `<span style="color: var(--success); display: flex; align-items: center; justify-content: center; gap: 6px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"></path></svg>
            ${count} pemain bersiap!
        </span><br><small style="color: var(--text-muted);">${names.join(', ')}</small>`;
    }
    
    document.getElementById('active-players').innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span>Pemain: ${count}</span>
    `;
}

function startGame(mode) {
    currentMode = mode;
    lastKnownAspectRatio = null;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Broadcast mode change to all clients
    broadcast({ type: 'START_GAME', mode: mode });

    const btnResetCanvas = document.getElementById('btn-reset-canvas');
    const gameTimer = document.getElementById('game-timer');

    if (mode === 'freeplay') {
        doodleCanvas.clear();
        document.getElementById('battle-header').classList.add('hidden');
        document.getElementById('host-canvas-container').classList.remove('hidden');
        const progressContainer = document.getElementById('battle-progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
        if (btnResetCanvas) btnResetCanvas.style.display = 'flex';
        if (gameTimer) gameTimer.style.display = 'none';
    } else if (mode === 'battle') {
        if (btnResetCanvas) btnResetCanvas.style.display = 'none';
        if (gameTimer) gameTimer.style.display = 'block';
        document.getElementById('host-canvas-container').classList.add('hidden');
        const progressContainer = document.getElementById('battle-progress-container');
        if (progressContainer) progressContainer.classList.remove('hidden');
        startBattleMode();
    }
}

function resetCanvasHost() {
    if (currentMode === 'freeplay') {
        doodleCanvas.clear();
        broadcast({ type: 'CLEAR_CANVAS' });
    }
}

function updateBattlePlayerStatus() {
    const battlePlayersStatus = document.getElementById('battle-players-status');
    if (!battlePlayersStatus) return;
    
    let statusHtml = '';
    for (const pid in players) {
        const hasSubmitted = doodles.some(d => d.playerId === pid);
        const icon = hasSubmitted ? 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : 
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="spin" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l-3.28 3.28M3 12a9 9 0 1 0 18 0"></path></svg>`;
            
        statusHtml += `
            <div style="background: ${hasSubmitted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${hasSubmitted ? 'var(--success)' : 'var(--text-muted)'}; padding: 10px 20px; border-radius: 30px; display: flex; align-items: center; gap: 10px; border: 1px solid ${hasSubmitted ? 'var(--success)' : 'var(--glass-border)'}; transition: all 0.3s; opacity: ${hasSubmitted ? '1' : '0.6'};">
                ${icon}
                <span style="font-weight: ${hasSubmitted ? '700' : '500'}; font-size: 1.1rem;">${players[pid].name}</span>
            </div>
        `;
    }
    battlePlayersStatus.innerHTML = statusHtml;
}

function startBattleMode() {
    doodles = [];
    votes = {};
    doodleCanvas.clear();
    
    const theme = themes[Math.floor(Math.random() * themes.length)];
    document.getElementById('battle-theme-name').innerText = `Tema: ${theme}`;
    document.getElementById('battle-header').classList.remove('hidden');
    
    // Broadcast to start battle
    let seconds = 60; // 60 seconds battle
    broadcast({ type: 'BATTLE_INFO', theme: theme, time: seconds });
    
    updateBattlePlayerStatus();
    
    // Start Timer
    if (battleTimer) clearInterval(battleTimer);
    const timerDisplay = document.getElementById('game-timer');
    const massiveTimer = document.getElementById('massive-timer');
    
    timerDisplay.innerText = formatTime(seconds);
    if (massiveTimer) massiveTimer.innerText = formatTime(seconds);
    timerDisplay.style.color = 'var(--text-main)';
    if (massiveTimer) massiveTimer.style.color = 'var(--accent-secondary)';

    battleTimer = setInterval(() => {
        seconds--;
        const timeStr = formatTime(seconds);
        timerDisplay.innerText = timeStr;
        if (massiveTimer) massiveTimer.innerText = timeStr;
        
        if (seconds <= 10) {
            timerDisplay.style.color = 'var(--danger)';
            if (massiveTimer) massiveTimer.style.color = 'var(--danger)';
        }
        
        if (seconds <= 0) {
            clearInterval(battleTimer);
            updateBattlePlayerStatus(); // force final status update
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

        document.getElementById('reveal-title').innerHTML = `
            <span style="display:flex; align-items:center; justify-content:center; gap:10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                ${doodle.name} — Skor: ${totalScore}
            </span>
        `;
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
        const medal = i === 0 ? '<svg style="color: gold;" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' : 
                      i === 1 ? '<svg style="color: silver;" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' : 
                      i === 2 ? '<svg style="color: #cd7f32;" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' : 
                      `#${i + 1}`;
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
