// === Firebase Configuration (Musisz Zastąpić Własnymi Kluczami!) ===
// Przejdź do Firebase Console -> Twój Projekt -> Ustawienia projektu (zębatka) -> Dodaj aplikację (ikona </> dla web)
// Skopiuj obiekt firebaseConfig i wklej go tutaj:
const firebaseConfig = {
  apiKey: "AIzaSyASSmHw3LVUu7lSql0QwGmmBcFkaNeMups",
  authDomain: "ozzy-14c19.firebaseapp.com",
  projectId: "ozzy-14c19",
  storageBucket: "ozzy-14c19.firebasestorage.app",
  messagingSenderId: "668337469201",
  appId: "1:668337469201:web:cd9d84d45c93d9b6e3feb0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===================================================================

// Pobieranie referencji do elementów DOM
const backgroundTractor = document.getElementById('animated-background-tractor');
const clickableOzzyWrapper = document.getElementById('clickable-ozzy-wrapper'); 
const scoreDisplay = document.getElementById('score');
const messageDisplay = document.getElementById('message-display');
const gameContainer = document.getElementById('game-container');

const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const nicknameInput = document.getElementById('nickname-input');
const showLeaderboardButton = document.getElementById('show-leaderboard-button');

let playerNickname = "Gracz";

const endScreen = document.getElementById('end-screen');
const finalScoreDisplay = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');
const showLeaderboardAfterGameButton = document.getElementById('show-leaderboard-after-game-button');

const leaderboardScreen = document.getElementById('leaderboard-screen');
const leaderboardList = document.getElementById('leaderboard-list');
const backToStartButton = document.getElementById('back-to-start-button');

let score = 0;
let timeoutId;
let isGameActive = false;

// --- Ustawienia Poziomu Trudności Czasu ---
let currentTimeLimit = 2000;
const INITIAL_TIME_LIMIT = 2000;
const DECREMENT_PER_CLICK = 50;
const MIN_TIME_LIMIT = 500;

// --- Ustawienia Poziomu Trudności Ruchu ---
let animationFrameId;
let currentSpeed = 2;
const INITIAL_SPEED = 2;
const SPEED_INCREMENT = 0.5;
const MAX_SPEED = 10;

let dx, dy;

const CLICKS_FOR_DIFFICULTY_INCREASE = 5;

// --- Referencje do elementów audio (DODANE) ---
const backgroundMusic = document.getElementById('background-music');
const deathSound = document.getElementById('death-sound');


// --- Funkcje Leaderboarda ---
async function saveScoreToLeaderboard(nickname, score) {
    if (score > 0) {
        try {
            await db.collection("leaderboard").add({
                nickname: nickname,
                score: score,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Wynik zapisany pomyślnie!");
        } catch (e) {
            console.error("Błąd podczas zapisywania wyniku: ", e);
        }
    }
}

async function fetchAndDisplayLeaderboard() {
    leaderboardList.innerHTML = '';
    try {
        const snapshot = await db.collection("leaderboard")
                                 .orderBy("score", "desc")
                                 .orderBy("timestamp", "asc")
                                 .limit(10)
                                 .get();

        if (snapshot.empty) {
            leaderboardList.innerHTML = '<li>Brak wyników w rankingu. Bądź pierwszy!</li>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            li.textContent = `${data.nickname || 'Anonim'}: ${data.score} kg`;
            leaderboardList.appendChild(li);
        });
    } catch (e) {
        console.error("Błąd podczas pobierania rankingu: ", e);
        leaderboardList.innerHTML = '<li>Wystąpił błąd podczas ładowania rankingu.</li>';
    }
}

// --- Funkcje Gry ---
function resetGame() {
    score = 0;
    scoreDisplay.textContent = score;
    clickableOzzyWrapper.classList.add('hidden');
    messageDisplay.style.display = 'none';
    clearTimeout(timeoutId);
    cancelAnimationFrame(animationFrameId);
    currentSpeed = INITIAL_SPEED;

    isGameActive = false;
    endScreen.classList.add('hidden');
    leaderboardScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    currentTimeLimit = INITIAL_TIME_LIMIT;
    nicknameInput.value = playerNickname;

    // Zatrzymaj muzykę w tle, gdy gra jest resetowana (np. powrót do menu) (DODANE)
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0; // Zresetuj czas odtwarzania
    }
}

function showMessage(message, duration = 1500) {
    messageDisplay.textContent = message;
    messageDisplay.style.display = 'block';
    messageDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    messageDisplay.style.borderColor = 'lime';
    messageDisplay.style.color = 'white';
    setTimeout(() => {
        messageDisplay.style.display = 'none';
    }, duration);
}

function moveTargetImage() {
    const containerWidth = gameContainer.offsetWidth;
    const containerHeight = gameContainer.offsetHeight;

    const targetWidth = clickableOzzyWrapper.offsetWidth;
    const targetHeight = clickableOzzyWrapper.offsetHeight;

    const maxX = containerWidth - targetWidth;
    const maxY = containerHeight - targetHeight;

    const randomX = Math.max(0, Math.min(Math.random() * maxX, maxX));
    const randomY = Math.max(0, Math.min(Math.random() * maxY, maxY));

    clickableOzzyWrapper.style.left = `${randomX}px`;
    clickableOzzyWrapper.style.top = `${randomY}px`;

    console.log(`MOVE (Old Logic): Container: ${containerWidth}x${containerHeight}, Target Wrapper: ${targetWidth}x${targetHeight}`);
    console.log(`MOVE (Old Logic): Max X: ${maxX}, Max Y: ${maxY}`);
    console.log(`MOVE (Old Logic): New Ozzy Wrapper Pos: ${randomX.toFixed(2)}, ${randomY.toFixed(2)}`);
}

function animateTargetImage() {
    if (!isGameActive || clickableOzzyWrapper.classList.contains('hidden')) {
        cancelAnimationFrame(animationFrameId);
        return;
    }

    let x = clickableOzzyWrapper.offsetLeft;
    let y = clickableOzzyWrapper.offsetTop;

    const targetWidth = clickableOzzyWrapper.offsetWidth;
    const targetHeight = clickableOzzyWrapper.offsetHeight;

    const containerWidth = gameContainer.offsetWidth;
    const containerHeight = gameContainer.offsetHeight;

    x += dx;
    y += dy;

    if (x + targetWidth > containerWidth) {
        x = containerWidth - targetWidth;
        dx = -dx;
        console.log(`Bounce X (right): New X=${x.toFixed(2)}`);
    } else if (x < 0) {
        x = 0;
        dx = -dx;
        console.log(`Bounce X (left): New X=${x.toFixed(2)}`);
    }

    if (y + targetHeight > containerHeight) {
        y = containerHeight - targetHeight;
        dy = -dy;
        console.log(`Bounce Y (bottom): New Y=${y.toFixed(2)}`);
    } else if (y < 0) {
        y = 0;
        dy = -dy;
        console.log(`Bounce Y (top): New Y=${y.toFixed(2)}`);
    }

    clickableOzzyWrapper.style.left = `${x}px`;
    clickableOzzyWrapper.style.top = `${y}px`;

    animationFrameId = requestAnimationFrame(animateTargetImage);
}

function startRound() {
    if (!isGameActive) return;

    clickableOzzyWrapper.classList.remove('hidden');
    moveTargetImage();

    dx = (Math.random() < 0.5 ? 1 : -1) * currentSpeed;
    dy = (Math.random() < 0.5 ? 1 : -1) * currentSpeed;

    cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(animateTargetImage);

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
        if (isGameActive) {
            endGame('Ozzy zjadł całe gówno! Przegrałeś!');
        }
    }, currentTimeLimit);
}

function endGame(message) {
    isGameActive = false;
    clearTimeout(timeoutId);
    cancelAnimationFrame(animationFrameId);

    clickableOzzyWrapper.classList.add('hidden');
    messageDisplay.style.display = 'none';

    document.getElementById('end-message').textContent = message;
    finalScoreDisplay.textContent = score;

    if (playerNickname.trim() !== "") {
        saveScoreToLeaderboard(playerNickname, score);
    }

    endScreen.classList.remove('hidden');

    // Zatrzymaj muzykę w tle po zakończeniu gry (DODANE)
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

function handleTargetClick(event) {
    if (isGameActive && event.currentTarget === clickableOzzyWrapper && !clickableOzzyWrapper.classList.contains('hidden')) {
        event.stopPropagation();
        score++;
        scoreDisplay.textContent = score;
        clearTimeout(timeoutId);
        cancelAnimationFrame(animationFrameId);

        clickableOzzyWrapper.classList.add('hidden');

        // Odtwórz dźwięk śmierci/kliknięcia (DODANE)
        if (deathSound) {
            deathSound.currentTime = 0; // Zresetuj dźwięk, aby mógł być odtworzony ponownie natychmiast
            deathSound.play().catch(e => console.error("Błąd odtwarzania deathSound:", e));
        }

        if (score > 0 && score % CLICKS_FOR_DIFFICULTY_INCREASE === 0) {
            currentTimeLimit = Math.max(MIN_TIME_LIMIT, currentTimeLimit - DECREMENT_PER_CLICK);
            currentSpeed = Math.min(MAX_SPEED, currentSpeed + SPEED_INCREMENT);
            console.log(`Zwiększenie trudności! Nowy limit czasu: ${currentTimeLimit}ms, Nowa prędkość: ${currentSpeed}`);
        }

        setTimeout(() => {
            if (isGameActive) {
                startRound();
            }
        }, 300);
    }
}

// ---- Obsługa zdarzeń ----
startButton.addEventListener('click', () => {
    const nick = nicknameInput.value.trim();
    if (nick === "") {
        showMessage("Musisz wpisać swój nick!", 2000);
        return;
    }
    playerNickname = nick;
    
    startScreen.classList.add('hidden');
    isGameActive = true;
    score = 0;
    scoreDisplay.textContent = score;
    currentTimeLimit = INITIAL_TIME_LIMIT;
    currentSpeed = INITIAL_SPEED;
    startRound();

    // Rozpocznij odtwarzanie muzyki w tle po pierwszym kliknięciu użytkownika (DODANE)
    if (backgroundMusic) {
        backgroundMusic.play().catch(e => console.error("Błąd odtwarzania backgroundMusic:", e));
    }
});

restartButton.addEventListener('click', () => {
    resetGame();
});

clickableOzzyWrapper.addEventListener('click', handleTargetClick);

clickableOzzyWrapper.addEventListener('touchstart', (event) => {
    event.preventDefault();
    handleTargetClick(event);
}, { passive: false });

window.addEventListener('resize', () => {
    if (isGameActive && !clickableOzzyWrapper.classList.contains('hidden')) {
        moveTargetImage();
    }
});

backgroundTractor.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

clickableOzzyWrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

backgroundTractor.addEventListener('dragstart', (e) => {
    e.preventDefault();
});
clickableOzzyWrapper.addEventListener('dragstart', (e) => {
    e.preventDefault();
});

showLeaderboardButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    leaderboardScreen.classList.remove('hidden');
    fetchAndDisplayLeaderboard();
});

showLeaderboardAfterGameButton.addEventListener('click', () => {
    endScreen.classList.add('hidden');
    leaderboardScreen.classList.remove('hidden');
    fetchAndDisplayLeaderboard();
});

backToStartButton.addEventListener('click', () => {
    leaderboardScreen.classList.add('hidden');
    resetGame();
});

document.addEventListener('DOMContentLoaded', () => {
    resetGame();
    console.log("Initial game container dimensions:", gameContainer.offsetWidth, gameContainer.offsetHeight);
    console.log("Initial target image (Ozzy) dimensions:", clickableOzzyWrapper.offsetWidth, clickableOzzyWrapper.offsetHeight);
});
