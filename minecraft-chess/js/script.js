// Contenido COMPLETO para js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM para el juego
    const boardElement = document.getElementById('board');
    const playerTurnElement = document.getElementById('player-turn');
    const statusElement = document.getElementById('status');
    const newGameButton = document.getElementById('new-game-button'); // <<--- NEWGAMEBUTTON SE DEFINE AQUÍ
    const capturedWhiteElement = document.getElementById('captured-white');
    const capturedBlackElement = document.getElementById('captured-black');

    // Elementos del DOM para controles de IA
    const gameModeSelect = document.getElementById('game-mode');
    const aiDifficultySelectorDiv = document.getElementById('ai-difficulty-selector');
    const aiDifficultySelect = document.getElementById('ai-difficulty');

    // Variables para la funcionalidad de pantalla completa
    const fullscreenButton = document.getElementById('fullscreen-button');
    const gameContainer = document.querySelector('.game-container');

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

    // --- Inicialización de Stockfish ---
    try {
        stockfish = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker('js/lib/stockfish.js');
        
        stockfish.onmessage = function(event) {
            const rawMessage = event.data || event;
            console.log("Stockfish RAW:", rawMessage); // PARA DEPURAR EL MENSAJE ORIGINAL

            let messageString = "";
            if (typeof rawMessage === 'string') {
                messageString = rawMessage;
            } else if (typeof rawMessage === 'object' && rawMessage !== null && typeof rawMessage.data === 'string') {
                messageString = rawMessage.data;
            } else if (typeof rawMessage === 'object' && rawMessage !== null) {
                console.log("Stockfish envió un objeto, intentando convertir a string o buscar propiedad:", rawMessage);
                // Intenta convertir a string si es un objeto simple, o busca propiedades comunes
                // Esto es para depuración, la lógica real debe manejar el formato esperado
                if (rawMessage.message) messageString = String(rawMessage.message); // Ejemplo si el mensaje estuviera en .message
                else messageString = JSON.stringify(rawMessage); // Como último recurso, para ver qué es
            } else {
                console.error("Stockfish envió un mensaje en un formato inesperado:", rawMessage);
                return; 
            }
            
            console.log("Stockfish procesado como string:", messageString);

            if (messageString && typeof messageString.startsWith === 'function' && messageString.startsWith('bestmove')) {
                const bestMove = messageString.split(' ')[1];
                if (bestMove && bestMove !== '(none)' && bestMove.length >= 4) { // Verificación básica de validez del movimiento
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
                    stockfish.postMessage('isready'); // Enviar isready después de uciok
                } else if (messageString.startsWith('readyok')) {
                    console.log("Stockfish READYOK recibido.");
                    // El motor está listo. Si es el turno de la IA al inicio, podría mover.
                    if (isAIActive && game.turn() !== playerColor && !isAITurn) {
                        // makeAIMove(); // Considerar si la IA debe mover si el juego ya empezó y es su turno
                    }
                }
                // Puedes loguear otros mensajes para depuración:
                // else { console.log("Stockfish (otro mensaje):", messageString); }
            }
        };
        
        stockfish.postMessage = stockfish.postMessage || function(msg) { stockfish.onmessage({data: msg}); };
        stockfish.postMessage('uci'); // Inicia el motor UCI
        // No enviar 'isready' aquí, esperar a 'uciok'

    } catch (e) {
        console.error("Error al inicializar Stockfish:", e);
        if (gameModeSelect) { // Asegurarse que el elemento existe antes de modificarlo
             alert("No se pudo cargar la IA (Stockfish). Revisa la consola para más detalles. Asegúrate que 'stockfish.js' y 'stockfish.wasm' están en 'js/lib/'. El juego continuará en modo Humano vs Humano.");
            gameModeSelect.value = "human";
            if (aiDifficultySelectorDiv) aiDifficultySelectorDiv.style.display = 'none';
        }
        isAIActive = false;
    }

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
        console.log(`Enviando a Stockfish: position fen ${fen}`);
        stockfish.postMessage(`position fen ${fen}`);
        console.log(`Enviando a Stockfish: setoption name Skill Level value ${aiSkillLevel}`);
        stockfish.postMessage(`setoption name Skill Level value ${aiSkillLevel}`);
        console.log("Enviando a Stockfish: go movetime 1000");
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

        isAIActive = gameModeSelect && gameModeSelect.value === 'ai'; // Comprobar si gameModeSelect existe
        if (isAIActive) {
            aiSkillLevel = aiDifficultySelect ? parseInt(aiDifficultySelect.value, 10) : 0;
            playerColor = 'w';
            console.log(`Iniciando juego contra IA. Dificultad (Skill Level): ${aiSkillLevel}`);
            if (stockfish) {
                stockfish.postMessage('ucinewgame');
                stockfish.postMessage(`setoption name Skill Level value ${aiSkillLevel}`);
                stockfish.postMessage('isready'); // Preguntar si está listo para el nuevo juego
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
    if (gameModeSelect) { // Comprobar si el elemento existe antes de añadir listener
        gameModeSelect.addEventListener('change', function() {
            if (aiDifficultySelectorDiv) { // Comprobar si el div existe
                aiDifficultySelectorDiv.style.display = this.value === 'ai' ? 'block' : 'none';
            }
            // Opcional: Iniciar nueva partida automáticamente al cambiar modo si se desea
            // startNewGame(); 
        });
    }

    if (newGameButton) { // Comprobar si newGameButton existe
        newGameButton.addEventListener('click', startNewGame);
    }
    
    // Configuración inicial de visibilidad del selector de dificultad
    if (gameModeSelect && aiDifficultySelectorDiv) { // Comprobar ambos
        aiDifficultySelectorDiv.style.display = gameModeSelect.value === 'ai' ? 'block' : 'none';
    }
    
    startNewGame(); // Iniciar el juego la primera vez

}); // Fin de DOMContentLoaded