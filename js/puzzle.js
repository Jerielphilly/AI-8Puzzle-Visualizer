// Puzzle State and Logic Utility

class PuzzleState {
    /**
     * @param {number[]} board - 1D array of 9 elements representing the board (0 is blank)
     * @param {PuzzleState} parent - Parent state
     * @param {number} move - The move taken to reach this state (e.g. index moved)
     * @param {number} cost - Path cost g(n)
     */
    constructor(board, parent = null, move = null, cost = 0) {
        this.board = board;
        this.parent = parent;
        this.move = move; // Which index swapped with 0
        this.cost = cost; // g(n)
        this.depth = parent ? parent.depth + 1 : 0;
        this.str = board.join(''); // for quick Set lookups
    }

    isGoal(goalState) {
        return this.str === goalState.join('');
    }

    // Get valid successors
    getSuccessors() {
        const successors = [];
        const blankIdx = this.board.indexOf(0);
        const row = Math.floor(blankIdx / 3);
        const col = blankIdx % 3;

        // Possible moves: up, down, left, right relative to blank tile
        const moves = [];
        if (row > 0) moves.push(blankIdx - 3); // Up
        if (row < 2) moves.push(blankIdx + 3); // Down
        if (col > 0) moves.push(blankIdx - 1); // Left
        if (col < 2) moves.push(blankIdx + 1); // Right

        for (let target of moves) {
            const newBoard = [...this.board];
            // Swap
            newBoard[blankIdx] = newBoard[target];
            newBoard[target] = 0;
            
            successors.push(new PuzzleState(newBoard, this, target, this.cost + 1));
        }

        return successors;
    }

    // Get path from root to this state
    getPath() {
        const path = [];
        let curr = this;
        while (curr) {
            path.unshift(curr);
            curr = curr.parent;
        }
        return path;
    }
}

// Heuristics
const Heuristics = {
    misplacedTiles(stateBoard, goalBoard) {
        let count = 0;
        for (let i = 0; i < 9; i++) {
            if (stateBoard[i] !== 0 && stateBoard[i] !== goalBoard[i]) {
                count++;
            }
        }
        return count;
    },

    manhattanDistance(stateBoard, goalBoard) {
        let distance = 0;
        for (let i = 0; i < 9; i++) {
            let val = stateBoard[i];
            if (val !== 0) {
                let targetIdx = goalBoard.indexOf(val);
                
                let currRow = Math.floor(i / 3);
                let currCol = i % 3;
                let targetRow = Math.floor(targetIdx / 3);
                let targetCol = targetIdx % 3;
                
                distance += Math.abs(currRow - targetRow) + Math.abs(currCol - targetCol);
            }
        }
        return distance;
    }
};

// Utility to check solvability
function countInversions(board) {
    let inversions = 0;
    const arr = board.filter(n => n !== 0);
    for (let i = 0; i < arr.length - 1; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            if (arr[i] > arr[j]) inversions++;
        }
    }
    return inversions;
}

// Two states are mutually solvable if their inversion parities match
// But wait, since the goal state might not be standard [1,2,3,4,5,6,7,8,0],
// we should map the standard elements to the goal state elements.
function isSolvable(initial, goal) {
    // Mapping goal state values to 1..8
    let mapping = {};
    let order = 1;
    for (let i = 0; i < 9; i++) {
        if (goal[i] !== 0) {
            mapping[goal[i]] = order++;
        }
    }

    // Map initial state
    let mappedInitial = initial.map(val => val === 0 ? 0 : mapping[val]);
    let initialInversions = countInversions(mappedInitial);
    
    // For 3x3 grid, parity of inversions is invariant.
    // Goal state in mapped version is [1,2,3,4,5,6,7,8,0] which has 0 inversions (even).
    // So mapped initial state must have an even number of inversions.
    return initialInversions % 2 === 0;
}

function generateRandomSolvable(goal) {
    let board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    do {
        // Shuffle
        for (let i = board.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [board[i], board[j]] = [board[j], board[i]];
        }
    } while (!isSolvable(board, goal) || board.join('') === goal.join(''));
    return board;
}
