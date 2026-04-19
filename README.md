# 🎨 Doodle Party

A real-time drawing game where your PC is the big screen and your phone is the canvas! Inspired by the "Slightly Artistic" show. 

Built with **HTML5 Canvas** and **PeerJS** for a serverless, real-time experience.

## 🚀 How to Play
1.  Open `index.html` on your PC.
2.  Scan the QR code with your phone (or open the link displayed).
3.  Join as a player.
4.  Choose a mode: **Freeplay** (chaos!) or **Bertarung** (battle!).

## 🛠️ How to Deploy to GitHub Pages
Since this game uses PeerJS for direct communication, it can be hosted as a **static site**.

1.  Create a new repository on GitHub.
2.  Upload all files from this folder to the repository.
3.  Go to **Settings** > **Pages**.
4.  Under **Build and deployment**, select `Deploy from a branch` and choose `main` (or `master`).
5.  Save and wait for the URL to be generated.
6.  **Important**: Both the PC and Phone must use the same GitHub Pages URL to communicate!

## ✨ Features
- **Freeplay Mode**: Everyone draws on the same canvas in real-time.
- **Battle Mode**: 
    - Random themes.
    - Customizable timer (3-6 minutes).
    - Private drawing on mobile devices.
    - One-by-one results reveal.
    - Player voting system (1-6 scale).
    - Final leaderboard.
- **Premium UI**: Dark-themed glassmorphism design with responsiveness.

## 📦 Tech Stack
- **PeerJS**: Peer-to-Peer communication.
- **QRCode.js**: QR code generation for easy joining.
- **CSS3**: Modern glassmorphism and animations.
- **Vanilla JavaScript**: Pure logic, no bulky frameworks.
