document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tetris-canvas');
    const context = canvas.getContext('2d');
    const nextPieceCanvas = document.getElementById('next-piece-canvas');
    const nextPieceContext = nextPieceCanvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');
    const resetButton = document.getElementById('reset-button');
    const gameOverMessage = document.getElementById('game-over-message');
    const finalScoreElement = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = canvas.width / COLS; // 200 / 10 = 20
    const NEXT_PIECE_BLOCK_SIZE = nextPieceCanvas.width / 4; // 80 / 4 = 20

    // Adjust canvas height based on block size and rows
    canvas.height = ROWS * BLOCK_SIZE; // 20 * 20 = 400

    const COLORS = [
        null,        // 0 - Empty
        '#FF0D72',   // 1 - I
        '#0DC2FF',   // 2 - J
        '#0DFF72',   // 3 - L
        '#F538FF',   // 4 - O
        '#FF8E0D',   // 5 - S
        '#FFE138',   // 6 - T
        '#3877FF'    // 7 - Z
    ];

    const TETROMINOES = {
        'I': [[1, 1, 1, 1]],
        'J': [[2, 0, 0], [2, 2, 2]],
        'L': [[0, 0, 3], [3, 3, 3]],
        'O': [[4, 4], [4, 4]],
        'S': [[0, 5, 5], [5, 5, 0]],
        'T': [[0, 6, 0], [6, 6, 6]],
        'Z': [[7, 7, 0], [0, 7, 7]]
    };

    let board = createBoard();
    let currentPiece;
    let nextPiece;
    let score = 0;
    let gameOver = false;
    let paused = false;
    let dropStart = Date.now();
    let dropInterval = 1000; // ms

    // --- Game Board ---
    function createBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function drawBoard() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) {
                    drawBlock(context, x, y, COLORS[value], BLOCK_SIZE);
                }
            });
        });
    }

    function drawBlock(ctx, x, y, color, blockSize) {
        ctx.fillStyle = color;
        ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
        ctx.strokeStyle = '#333'; // Block border
        ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
    }

    // --- Tetrominoes ---
    function getRandomPiece() {
        const types = 'IJLOSTZ';
        const type = types[Math.floor(Math.random() * types.length)];
        const matrix = TETROMINOES[type];
        const colorIndex = types.indexOf(type) + 1; // +1 because COLORS[0] is null
        return {
            matrix: matrix.map(row => row.map(cell => cell > 0 ? colorIndex : 0)),
            x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2),
            y: 0
        };
    }

    function drawPiece(piece, ctx, blockSize) {
        piece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) {
                    drawBlock(ctx, piece.x + x, piece.y + y, COLORS[value], blockSize);
                }
            });
        });
    }

    function drawNextPiece() {
        nextPieceContext.clearRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
        if (nextPiece) {
            // Center the piece in the preview box
            const pieceWidth = nextPiece.matrix[0].length * NEXT_PIECE_BLOCK_SIZE;
            const pieceHeight = nextPiece.matrix.length * NEXT_PIECE_BLOCK_SIZE;
            const offsetX = (nextPieceCanvas.width - pieceWidth) / 2;
            const offsetY = (nextPieceCanvas.height - pieceHeight) / 2;

            nextPiece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value > 0) {
                        nextPieceContext.fillStyle = COLORS[value];
                        nextPieceContext.fillRect(
                            offsetX + x * NEXT_PIECE_BLOCK_SIZE,
                            offsetY + y * NEXT_PIECE_BLOCK_SIZE,
                            NEXT_PIECE_BLOCK_SIZE,
                            NEXT_PIECE_BLOCK_SIZE
                        );
                        nextPieceContext.strokeStyle = '#333';
                        nextPieceContext.strokeRect(
                            offsetX + x * NEXT_PIECE_BLOCK_SIZE,
                            offsetY + y * NEXT_PIECE_BLOCK_SIZE,
                            NEXT_PIECE_BLOCK_SIZE,
                            NEXT_PIECE_BLOCK_SIZE
                        );
                    }
                });
            });
        }
    }


    // --- Piece Movement & Collision ---
    function movePiece(dx, dy) {
        if (!collides(currentPiece, dx, dy, board)) {
            currentPiece.x += dx;
            currentPiece.y += dy;
            return true;
        }
        if (dy > 0) { // If moving down and collides, lock the piece
            lockPiece();
            spawnNewPiece();
        }
        return false;
    }

    function rotatePiece() {
        const originalMatrix = currentPiece.matrix;
        const N = originalMatrix.length;
        const M = originalMatrix[0].length;
        const newMatrix = Array.from({ length: M }, () => Array(N).fill(0));

        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                newMatrix[j][N - 1 - i] = originalMatrix[i][j];
            }
        }
        currentPiece.matrix = newMatrix;

        // Handle collision after rotation (wall kick)
        let offset = 1;
        while (collides(currentPiece, 0, 0, board)) {
            currentPiece.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1)); // Try -1, 2, -2, etc.
            if (offset > currentPiece.matrix[0].length) { // If cannot resolve collision
                currentPiece.matrix = originalMatrix; // Revert rotation
                return;
            }
        }
    }

    function collides(piece, dx, dy, gameBoard) {
        for (let y = 0; y < piece.matrix.length; y++) {
            for (let x = 0; x < piece.matrix[y].length; x++) {
                if (piece.matrix[y][x] > 0) {
                    let newX = piece.x + x + dx;
                    let newY = piece.y + y + dy;

                    // Check boundaries
                    if (newX < 0 || newX >= COLS || newY >= ROWS) {
                        return true;
                    }
                    // Check against locked pieces on the board (only if newY is non-negative)
                    if (newY >= 0 && gameBoard[newY] && gameBoard[newY][newX] > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function lockPiece() {
        currentPiece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) {
                    if (currentPiece.y + y < 0) { // Piece locked above the visible board
                        setGameOver();
                        return;
                    }
                    board[currentPiece.y + y][currentPiece.x + x] = value;
                }
            });
        });
        removeFullLines();
    }

    // --- Line Clearing & Score ---
    function removeFullLines() {
        let linesCleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(cell => cell > 0)) {
                board.splice(y, 1); // Remove the full line
                board.unshift(Array(COLS).fill(0)); // Add an empty line at the top
                linesCleared++;
                y++; // Re-check the current line index as it's now a new line
            }
        }
        if (linesCleared > 0) {
            updateScore(linesCleared);
        }
    }

    function updateScore(linesCleared) {
        const linePoints = [0, 40, 100, 300, 1200]; // Points for 0, 1, 2, 3, 4 lines
        score += linePoints[linesCleared] || 0;
        scoreElement.textContent = score;
        // Increase speed
        if (linesCleared > 0 && dropInterval > 200) { // Cap speed
            dropInterval = Math.max(200, 1000 - Math.floor(score / 500) * 50);
        }
    }

    // --- Game Loop ---
    function gameLoop(time = 0) {
        if (gameOver || paused) {
            return;
        }

        const now = Date.now();
        const delta = now - dropStart;

        if (delta > dropInterval) {
            movePiece(0, 1); // Move down
            dropStart = Date.now();
        }

        drawBoard();
        if (currentPiece) {
            drawPiece(currentPiece, context, BLOCK_SIZE);
        }
        drawNextPiece();

        requestAnimationFrame(gameLoop);
    }

    // --- User Input ---
    document.addEventListener('keydown', event => {
        if (gameOver || paused) return;

        if (event.key === 'ArrowLeft') {
            movePiece(-1, 0);
        } else if (event.key === 'ArrowRight') {
            movePiece(1, 0);
        } else if (event.key === 'ArrowDown') {
            movePiece(0, 1);
            dropStart = Date.now(); // Reset drop timer for faster manual drop
        } else if (event.key === 'ArrowUp') {
            rotatePiece();
        } else if (event.key.toLowerCase() === 'p') { // Pause with 'P' key
            togglePause();
        }
    });

    // --- Game State ---
    function startGame() {
        board = createBoard();
        score = 0;
        updateScore(0); // Reset score display
        dropInterval = 1000;
        gameOver = false;
        paused = false;
        currentPiece = getRandomPiece();
        nextPiece = getRandomPiece();
        gameOverMessage.classList.add('hidden');
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = false;
        pauseButton.textContent = '暂停';
        dropStart = Date.now();
        gameLoop();
    }

    function setGameOver() {
        gameOver = true;
        finalScoreElement.textContent = score;
        gameOverMessage.classList.remove('hidden');
        startButton.disabled = true; // Keep start disabled until reset or new game
        pauseButton.disabled = true;
        // resetButton.disabled = false; // Reset is already enabled
    }

    function resetGame() {
        board = createBoard();
        score = 0;
        updateScore(0);
        dropInterval = 1000;
        gameOver = false;
        paused = false;
        currentPiece = null; // Will be set by spawnNewPiece
        nextPiece = null;   // Will be set by spawnNewPiece
        gameOverMessage.classList.add('hidden');
        startButton.disabled = false;
        pauseButton.disabled = true;
        pauseButton.textContent = '暂停';
        resetButton.disabled = true;
        context.clearRect(0, 0, canvas.width, canvas.height); // Clear main canvas
        nextPieceContext.clearRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height); // Clear next piece canvas
        // Don't start gameLoop here, wait for "Start Game" button
    }

    function spawnNewPiece() {
        currentPiece = nextPiece;
        nextPiece = getRandomPiece();
        if (collides(currentPiece, 0, 0, board)) {
            setGameOver();
        }
    }

    function togglePause() {
        if (gameOver) return;
        paused = !paused;
        pauseButton.textContent = paused ? '继续' : '暂停';
        if (!paused) {
            dropStart = Date.now(); // Recalibrate drop timer
            gameLoop();
        }
    }

    // --- Event Listeners for Buttons ---
    startButton.addEventListener('click', () => {
        startGame();
    });

    pauseButton.addEventListener('click', () => {
        togglePause();
    });

    resetButton.addEventListener('click', () => {
        // If game is over, reset directly. If game is running, pause and confirm.
        if (gameOver) {
             resetGame();
             startGame(); // Immediately start a new game after reset from game over
        } else if (!paused) {
            togglePause(); // Pause the game
            if (confirm("确定要重新开始游戏吗？当前进度将丢失。")) {
                resetGame();
                startGame();
            } else {
                togglePause(); // Resume if cancelled
            }
        } else { // Game is paused
             if (confirm("确定要重新开始游戏吗？当前进度将丢失。")) {
                resetGame();
                startGame();
            }
        }
    });

    restartButton.addEventListener('click', () => { // Button on game over message
        resetGame();
        startGame();
    });

    // Initial setup
    resetGame(); // Prepare the game, but don't start until button click
    drawBoard(); // Draw empty board initially
    // No initial piece drawing, wait for start.
});
