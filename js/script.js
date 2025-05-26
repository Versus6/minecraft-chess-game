// Contenido COMPLETO para js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM para el juego
    const boardElement = document.getElementById('board');
    const playerTurnElement = document.getElementById('player-turn');
    const statusElement = document.getElementById('status');
    const newGameButton = document.getElementById('new-game-button');
    const capturedWhiteElement = document.getElementById('captured-white');
    const capturedBlackElement = document.getElementById('captured-black');

    // Elementos del DOM para controles de IA
    const gameModeSelect = document.getElementById('game-mode');
    const aiDifficultySelectorDiv = document.getElementById('ai-difficulty-selector');
    const aiDifficultySelect = document.getElementById('ai-difficulty');

    // Variables para la funcionalidad de pantalla completa
    const fullscreenButton = document.getElementById('fullscreen-button');
    const gameContainer = document.querySelector('.game-container');

    // Elemento de Audio para música de fondo
    const backgroundMusic = document.getElementById('background-music'); // NUEVA VARIABLE

    // Variables del juego
    let game = new Chess();
    let selectedSquare = null;
    let validMoves = [];

    // Variables de la IA
    let stockfish = null;
    let isAIActive = false;
    let playerColor = 'w';
    let aiSkillLevel = 0;
    let isAITurn = false;

    // Variable para control de música
    let musicStarted = false; // NUEVA VARIABLE

    // --- Inicialización de Stockfish ---
    try {
        stockfish = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker('js/lib/stockfish.js');
        
        stockfish.onmessage = function(event) {
            const rawMessage = event.data || event;
            // console.log("Stockfish RAW:", rawMessage); // Descomentar para depuración intensiva

            let messageString = "";
            if (typeof rawMessage === 'string') {
                messageString = rawMessage;
            } else if (typeof rawMessage === 'object' && rawMessage !== null && typeof rawMessage.data === 'string') {
                messageString = rawMessage.data;
            } else if (typeof rawMessage === 'object' && rawMessage !== null) {
                // Esto es principalmente para depuración si el formato no es un string o {data: string}
                if (rawMessage.message && typeof rawMessage.message === 'string') messageString = rawMessage.message;
                else messageString = JSON.stringify(rawMessage); 
                console.log("Stockfish envió un objeto complejo, convertido a:", messageString);
            } else {
                // console.error("Stockfish envió un mensaje en un formato inesperado:", rawMessage);
                return; 
            }
            
            // console.log("Stockfish procesado como string:", messageString); // Descomentar para depuración

            if (messageString && typeof messageString.startsWith === 'function' && messageString.startsWith('bestmove')) {
                const bestMove = messageString.split(' ')[1];
                if (bestMove && bestMove !== '(none)' && bestMove.length >= 4) { // Verificación básica
                    game.move(bestMove, { sloppy: true });
                    renderBoard();
                    updateStatus();
                    isAITurn = false;
                } else {
                    console.log("Stockfish no devolvió movimiento válido o fue (none):", bestMove);
                    isAITurn = false;
                }
            } else if (messageString && typeof messageString.startsWith === 'function') {
                if (messageString.startsWith('uciok')) {
                    console.log("Stockfish UCI OK recibido.");
                    stockfish.postMessage('isready');
                } else if (messageString.startsWith('readyok')) {
                    console.log("Stockfish READYOK recibido.");
                }
                // Puedes loguear otros mensajes para depuración:
                // else { console.log("Stockfish (otro mensaje):", messageString); }
            }
        };
        
        stockfish.postMessage = stockfish.postMessage || function(msg) { stockfish.onmessage({data: msg}); };
        stockfish.postMessage('uci');

    } catch (e) {
        console.error("Error al inicializar Stockfish:", e);
        if (gameModeSelect) {
             alert("No se pudo cargar la IA (Stockfish). Revisa la consola. El juego continuará en modo Humano vs Humano.");
            gameModeSelect.value = "human";
            if (aiDifficultySelectorDiv) aiDifficultySelectorDiv.style.display = 'none';
        }
        isAIActive = false;
    }

    // --- Control de Música de Fondo ---
    function playBackgroundMusic() {
        if (backgroundMusic && backgroundMusic.paused && !musicStarted) {
            backgroundMusic.volume = 0.2; // Volumen bajo para empezar (0.0 a 1.0)
            backgroundMusic.play()
                .then(() => {
                    musicStarted = true;
                    console.log("Música de fondo iniciada.");
                    // Remover listeners una vez que la música ha empezado por interacción
                    document.body.removeEventListener('click', playBackgroundMusicOnClick);
                    document.body.removeEventListener('keydown', playBackgroundMusicOnClick);
                })
                .catch(error => {
                    console.warn("Error al intentar reproducir música (puede ser bloqueo de autoplay):", error);
                });
        }
    }

    // Intentar reproducir música en la primera interacción del usuario
    function playBackgroundMusicOnClick() {
        // Esta función se llamará solo una vez gracias a { once: true } en los listeners
        playBackgroundMusic();
    }
    
    if (backgroundMusic) { // Solo añadir listeners si el elemento de audio existe
        document.body.addEventListener('click', playBackgroundMusicOnClick, { once: true });
        document.body.addEventListener('keydown', playBackgroundMusicOnClick, { once: true });
    } else {
        console.warn("Elemento de audio #background-music no encontrado.");
    }
    // --- Fin de Control de Música de Fondo ---

    // Mapeo de imágenes de piezas
    const pieceImageMap = {
        'p': 'P.png', 'r': 'R.png', 'n': 'N.png', 'b': 'B.png', 'q': 'Q.png', 'k': 'K.png'
    };
    const pieceMinecraftAltNames = {
        'wP': 'Aldeano (Peón Blanco)', 'wR': 'Torre Creeper (Torre Blanca)', 'wN': 'Devastador (Caballo Blanco)', 'wB': 'Enderman (Alfil Blanco)', 'wQ': 'Alex (Reina Blanca)', 'wK': 'Steve Coronado (Rey Blanco)',
        'bP': 'Aldeano Oscuro (Peón Negro)', 'bR': 'Torre Creeper Oscura (Torre Negra)', 'bN': 'Devastador Oscuro (Caballo Negro)', 'bB': 'Enderman Oscuro (Alfil Negro)', 'bQ': 'Alex Oscura (Reina Negra)', 'bK': 'Steve Coronado Oscuro (Rey Negro)'
    };

    // --- Funciones del Juego ---
    function createBoard() {
        boardElement.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.classList.add((i + j) % 2 === 0 ? 'light' : 'dark');
                const algebraic = String.fromCharCode('a'.charCodeAt(0) + j) + (8 - i);
                square.dataset.algebraic = algebraic;
                square.addEventListener('click', () => onSquareClick(algebraic));
                boardElement.appendChild(square);
            }
        }
    }

    function renderBoard() {
        const boardState = game.board();
        document.querySelectorAll('.square').forEach(sq => {
            sq.innerHTML = '';
            sq.classList.remove('selected', 'valid-move', 'capture-move');
        });
        boardState.forEach((row, rowIndex) => {
            row.forEach((piece, colIndex) => {
                if (piece) {
                    const algebraic = String.fromCharCode('a'.charCodeAt(0) + colIndex) + (8 - rowIndex);
                    const squareElement = boardElement.querySelector(`[data-algebraic="${algebraic}"]`);
                    if (!squareElement) {
                        console.error(`[renderBoard] No se encontró la casilla para: ${algebraic}.`);
                        return; 
                    }
                    const imgElement = document.createElement('img');
                    const piecePrefix = piece.color;
                    const pieceFileName = piecePrefix + pieceImageMap[piece.type];
                    imgElement.src = `assets/images/pieces/${pieceFileName}`;
                    imgElement.alt = pieceMinecraftAltNames[piecePrefix + piece.type.toUpperCase()] || `${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`;
                    imgElement.classList.add('piece-img');
                    squareElement.appendChild(imgElement);
                }
            });
        });
        updateStatus();
        updateCapturedPieces();
    }
    
    function onSquareClick(algebraic) {
        if (!musicStarted && backgroundMusic) { // Intenta iniciar música en cualquier clic de casilla si aún no ha empezado
            playBackgroundMusic();
        }

        if (game.game_over() || isAITurn) return;
        const clickedSquareElement = boardElement.querySelector(`[data-algebraic="${algebraic}"]`);
        const pieceOnClickedSquare = game.get(algebraic);
        if (selectedSquare) {
            const move = validMoves.find(m => m.to === algebraic);
            if (move) {
                let promotionPiece = null;
                const pieceToMove = game.get(selectedSquare);
                if (pieceToMove && pieceToMove.type === 'p' &&
                    ((pieceToMove.color === 'w' && algebraic.endsWith('8')) ||
                     (pieceToMove.color === 'b' && algebraic.endsWith('1')))) {
                    promotionPiece = 'q';
                }
                const moveObject = { from: selectedSquare, to: algebraic };
                if (promotionPiece) moveObject.promotion = promotionPiece;
                try {
                    game.move(moveObject);
                } catch (error) {
                    clearHighlights(); selectedSquare = null; validMoves = []; renderBoard(); return;
                }
                selectedSquare = null; validMoves = []; renderBoard(); updateStatus();
                if (isAIActive && !game.game_over() && game.turn() !== playerColor) {
                    setTimeout(makeAIMove, 250);
                }
            } else {
                clearHighlights();
                if (pieceOnClickedSquare && pieceOnClickedSquare.color === game.turn()) {
                    if (!isAIActive || game.turn() === playerColor) selectPiece(algebraic, clickedSquareElement);
                } else {
                    selectedSquare = null;
                }
            }
        } else {
            if (pieceOnClickedSquare && pieceOnClickedSquare.color === game.turn()) {
                 if (!isAIActive || game.turn() === playerColor) selectPiece(algebraic, clickedSquareElement);
            }
        }
    }

    function selectPiece(algebraic, squareElement) {
        selectedSquare = algebraic;
        if (squareElement) squareElement.classList.add('selected');
        else console.error("Intento de seleccionar una casilla (squareElement) que es null para: ", algebraic);
        highlightValidMoves(algebraic);
    }

    function clearHighlights() {
        document.querySelectorAll('.square.selected, .square.valid-move, .square.capture-move').forEach(sq => {
            sq.classList.remove('selected', 'valid-move', 'capture-move');
        });
    }
    
    function highlightValidMoves(fromSquare) {
        validMoves = game.moves({ square: fromSquare, verbose: true });
        validMoves.forEach(move => {
            const targetSquareElement = boardElement.querySelector(`[data-algebraic="${move.to}"]`);
            if (targetSquareElement) {
                targetSquareElement.classList.add('valid-move');
                if (move.flags.includes('c') || move.flags.includes('e')) targetSquareElement.classList.add('capture-move');
            }
        });
    }

    function updateStatus() {
        let statusText = '';
        const player = game.turn() === 'w' ? "Steve (Blancas)" : "Alex (Negras)";
        playerTurnElement.textContent = `Turno: ${player}`;
        if (game.in_checkmate()) statusText = `¡Jaque Mate! ${player} pierde.`;
        else if (game.in_draw()) statusText = "¡Empate!";
        else if (game.in_stalemate()) statusText = "¡Ahogado! Empate.";
        else if (game.in_threefold_repetition()) statusText = "¡Repetición Triple! Empate.";
        else if (game.insufficient_material()) statusText = "¡Material Insuficiente! Empate.";
        else if (game.in_check()) statusText = `¡${player} está en Jaque!`;
        statusElement.textContent = statusText;
    }

    function updateCapturedPieces() {
        capturedWhiteElement.innerHTML = "Piezas capturadas por Alex: ";
        capturedBlackElement.innerHTML = "Piezas capturadas por Steve: ";
        const history = game.history({ verbose: true });
        history.forEach(move => {
            if (move.captured) {
                const capturedPieceColor = move.color === 'w' ? 'b' : 'w';
                const capturedPieceType = move.captured;
                const pieceFileName = capturedPieceColor + pieceImageMap[capturedPieceType];
                const altText = pieceMinecraftAltNames[capturedPieceColor + capturedPieceType.toUpperCase()] || `Captured ${capturedPieceType}`;
                const img = document.createElement('img');
                img.src = `assets/images/pieces/${pieceFileName}`;
                img.alt = altText;
                img.classList.add('captured-piece-img');
                if (move.color === 'w') capturedBlackElement.appendChild(img);
                else capturedWhiteElement.appendChild(img);
            }
        });
    }

    function makeAIMove() {
        if (!isAIActive || !stockfish || game.game_over() || game.turn() === playerColor) return;
        isAITurn = true;
        const fen = game.fen();
        // console.log(`Enviando a Stockfish: position fen ${fen}`);
        stockfish.postMessage(`position fen ${fen}`);
        // console.log(`Enviando a Stockfish: setoption name Skill Level value ${aiSkillLevel}`);
        stockfish.postMessage(`setoption name Skill Level value ${aiSkillLevel}`);
        // console.log("Enviando a Stockfish: go movetime 1000");
        stockfish.postMessage('go movetime 1000'); 
    }

    // --- Lógica de Pantalla Completa ---
    function isFullscreen() {
        return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    }
    function toggleFullscreen() {
        if (!isFullscreen()) {
            if (gameContainer.requestFullscreen) gameContainer.requestFullscreen();
            else if (gameContainer.webkitRequestFullscreen) gameContainer.webkitRequestFullscreen();
            else if (gameContainer.mozRequestFullScreen) gameContainer.mozRequestFullScreen();
            else if (gameContainer.msRequestFullscreen) gameContainer.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
    }
    function updateFullscreenButton() {
        if (fullscreenButton) {
            fullscreenButton.textContent = isFullscreen() ? "Salir Pant. Completa" : "Pantalla Completa";
        }
    }
    if (fullscreenButton) fullscreenButton.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', updateFullscreenButton);
    document.addEventListener('MSFullscreenChange', updateFullscreenButton);
    
    // --- Inicialización del Juego y Controles ---
    function startNewGame() {
        game = new Chess();
        selectedSquare = null;
        validMoves = [];
        isAITurn = false;

        isAIActive = gameModeSelect && gameModeSelect.value === 'ai';
        if (isAIActive) {
            aiSkillLevel = aiDifficultySelect ? parseInt(aiDifficultySelect.value, 10) : 0;
            playerColor = 'w';
            console.log(`Iniciando juego contra IA. Dificultad (Skill Level): ${aiSkillLevel}`);
            if (stockfish) {
                stockfish.postMessage('ucinewgame');
                stockfish.postMessage(`setoption name Skill Level value ${aiSkillLevel}`);
                stockfish.postMessage('isready');
            }
        } else {
            console.log("Iniciando juego Humano vs Humano.");
        }
        
        createBoard(); 
        renderBoard();
        updateStatus();
        updateFullscreenButton();
    } 

    // Event Listeners para controles
    if (gameModeSelect) {
        gameModeSelect.addEventListener('change', function() {
            if (aiDifficultySelectorDiv) {
                aiDifficultySelectorDiv.style.display = this.value === 'ai' ? 'block' : 'none';
            }
        });
    }

    if (newGameButton) {
        newGameButton.addEventListener('click', () => {
            if (!musicStarted && backgroundMusic) { // Intenta iniciar música si se hace clic en Nueva Partida
                 playBackgroundMusic();
            }
            startNewGame();
        });
    }
    
    // Configuración inicial de visibilidad del selector de dificultad
    if (gameModeSelect && aiDifficultySelectorDiv) {
        aiDifficultySelectorDiv.style.display = gameModeSelect.value === 'ai' ? 'block' : 'none';
    }
    
    startNewGame(); // Iniciar el juego la primera vez

}); // Fin de DOMContentLoaded
