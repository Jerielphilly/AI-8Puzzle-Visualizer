// Algorithms implemented as JS Generators to allow stepping/pausing
// Yield format:
// {
//    status: 'running' | 'success' | 'failed',
//    current: PuzzleState,
//    frontierSize: number,
//    exploredSize: number,
//    nodesGenerated: number,
//    nodesExpanded: number,
//    maxDepth: number,
//    heuristicVal?: number, // for GBFS/A*
//    evalVal?: number       // for A*
// }

function createStatus(status, current, frontier, explored, generated, expanded, maxDepth, h = null, f = null) {
    return { status, current, frontierSize: frontier, exploredSize: explored, nodesGenerated: generated, nodesExpanded: expanded, maxDepth, h, f };
}

function* bfs(initialBoard, goalBoard) {
    let generated = 0;
    let expanded = 0;
    let maxDepth = 0;

    let startState = new PuzzleState(initialBoard);
    generated++;

    if (startState.isGoal(goalBoard)) {
        yield createStatus('success', startState, 0, 0, generated, expanded, maxDepth);
        return;
    }

    let frontier = [startState]; // FIFO
    let explored = new Set();
    let frontierSet = new Set([startState.str]); // For fast lookup

    while (frontier.length > 0) {
        let current = frontier.shift();
        frontierSet.delete(current.str);
        explored.add(current.str);
        expanded++;

        yield createStatus('running', current, frontier.length, explored.size, generated, expanded, maxDepth);

        for (let child of current.getSuccessors()) {
            generated++;
            if (child.depth > maxDepth) maxDepth = child.depth;

            if (!explored.has(child.str) && !frontierSet.has(child.str)) {
                if (child.isGoal(goalBoard)) {
                    yield createStatus('success', child, frontier.length, explored.size, generated, expanded, maxDepth);
                    return;
                }
                frontier.push(child);
                frontierSet.add(child.str);
            }
        }
    }
    yield createStatus('failed', null, frontier.length, explored.size, generated, expanded, maxDepth);
}

function* dfs(initialBoard, goalBoard) {
    let generated = 0;
    let expanded = 0;
    let maxDepth = 0;

    let startState = new PuzzleState(initialBoard);
    generated++;

    let frontier = [startState]; // LIFO
    let explored = new Set();
    let frontierSet = new Set([startState.str]);

    while (frontier.length > 0) {
        let current = frontier.pop();
        frontierSet.delete(current.str);

        if (current.isGoal(goalBoard)) {
            yield createStatus('success', current, frontier.length, explored.size, generated, expanded, maxDepth);
            return;
        }

        explored.add(current.str);
        expanded++;
        
        yield createStatus('running', current, frontier.length, explored.size, generated, expanded, maxDepth);

        // Reverse successors so that typical traversal order is maintained 
        // (pushing left-most last means it pops first)
        let successors = current.getSuccessors().reverse();

        for (let child of successors) {
            generated++;
            if (child.depth > maxDepth) maxDepth = child.depth;

            if (!explored.has(child.str) && !frontierSet.has(child.str)) {
                frontier.push(child);
                frontierSet.add(child.str);
            }
        }
    }
    yield createStatus('failed', null, frontier.length, explored.size, generated, expanded, maxDepth);
}


function* dls(initialBoard, goalBoard, limit, externalStats = null) {
    // externalStats used for IDDLS to accumulate over iterations
    let stats = externalStats || { generated: 0, expanded: 0, maxDepth: 0 };
    
    let startState = new PuzzleState(initialBoard);
    stats.generated++;

    let frontier = [startState]; // LIFO
    let exploredMap = new Map(); // Keep track of min depth reached for a state

    while (frontier.length > 0) {
        let current = frontier.pop();
        
        if (current.isGoal(goalBoard)) {
            yield createStatus('success', current, frontier.length, exploredMap.size, stats.generated, stats.expanded, stats.maxDepth);
            return;
        }

        stats.expanded++;
        exploredMap.set(current.str, current.depth);

        yield createStatus('running', current, frontier.length, exploredMap.size, stats.generated, stats.expanded, stats.maxDepth);

        if (current.depth < limit) {
            let successors = current.getSuccessors().reverse();
            for (let child of successors) {
                stats.generated++;
                if (child.depth > stats.maxDepth) stats.maxDepth = child.depth;
                
                // Explore if not visited OR visited at a deeper depth
                if (!exploredMap.has(child.str) || exploredMap.get(child.str) > child.depth) {
                    frontier.push(child);
                    // Update map to prevent other branches from redundantly exploring it at higher depth
                    exploredMap.set(child.str, child.depth);
                }
            }
        }
    }
    yield createStatus('failed', null, frontier.length, exploredMap.size, stats.generated, stats.expanded, stats.maxDepth);
}

function* iddls(initialBoard, goalBoard, maxLimit) {
    let stats = { generated: 0, expanded: 0, maxDepth: 0 };
    for (let limit = 0; limit <= maxLimit; limit++) {
        let dlsGenerator = dls(initialBoard, goalBoard, limit, stats);
        let result = dlsGenerator.next();
        
        while (!result.done) {
            if (result.value.status === 'success') {
                yield result.value;
                return;
            }
            if (result.value.status === 'running') {
                yield result.value;
            }
            result = dlsGenerator.next();
        }
        // If we exhausted DLS and didn't find it, we continue to next limit
    }
    yield createStatus('failed', null, 0, 0, stats.generated, stats.expanded, stats.maxDepth);
}

// Priority Queue for GBFS and A*
class PriorityQueue {
    constructor() {
        this.items = [];
    }
    enqueue(element, priority) {
        let qElement = { element, priority };
        let contain = false;
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].priority > qElement.priority) {
                this.items.splice(i, 0, qElement);
                contain = true;
                break;
            }
        }
        if (!contain) this.items.push(qElement);
    }
    dequeue() {
        if (this.isEmpty()) return null;
        return this.items.shift().element;
    }
    isEmpty() {
        return this.items.length === 0;
    }
}

function* gbfs(initialBoard, goalBoard, heuristicFn) {
    let generated = 0;
    let expanded = 0;
    let maxDepth = 0;

    let startState = new PuzzleState(initialBoard);
    generated++;

    let pq = new PriorityQueue();
    pq.enqueue(startState, heuristicFn(startState.board, goalBoard));

    let explored = new Set();
    let frontierMap = new Map(); // Track state to prevent re-adding
    frontierMap.set(startState.str, true);

    while (!pq.isEmpty()) {
        let current = pq.dequeue();
        frontierMap.delete(current.str);

        let hVal = heuristicFn(current.board, goalBoard);

        if (current.isGoal(goalBoard)) {
            yield createStatus('success', current, pq.items.length, explored.size, generated, expanded, maxDepth, hVal, hVal);
            return;
        }

        explored.add(current.str);
        expanded++;

        yield createStatus('running', current, pq.items.length, explored.size, generated, expanded, maxDepth, hVal, hVal);

        for (let child of current.getSuccessors()) {
            generated++;
            if (child.depth > maxDepth) maxDepth = child.depth;

            if (!explored.has(child.str) && !frontierMap.has(child.str)) {
                let priority = heuristicFn(child.board, goalBoard);
                pq.enqueue(child, priority);
                frontierMap.set(child.str, true);
            }
        }
    }
    yield createStatus('failed', null, pq.items.length, explored.size, generated, expanded, maxDepth);
}

function* astar(initialBoard, goalBoard, heuristicFn) {
    let generated = 0;
    let expanded = 0;
    let maxDepth = 0;

    let startState = new PuzzleState(initialBoard);
    generated++;

    let pq = new PriorityQueue();
    let startH = heuristicFn(startState.board, goalBoard);
    pq.enqueue(startState, startState.cost + startH);

    // map state.str -> cost (g value)
    let bestCost = new Map();
    bestCost.set(startState.str, startState.cost);
    let explored = new Set();

    while (!pq.isEmpty()) {
        let current = pq.dequeue();

        // If we found a better path earlier, skip this
        if (bestCost.get(current.str) < current.cost) continue;

        let hVal = heuristicFn(current.board, goalBoard);
        let fVal = current.cost + hVal;

        if (current.isGoal(goalBoard)) {
            yield createStatus('success', current, pq.items.length, explored.size, generated, expanded, maxDepth, hVal, fVal);
            return;
        }

        explored.add(current.str);
        expanded++;

        yield createStatus('running', current, pq.items.length, explored.size, generated, expanded, maxDepth, hVal, fVal);

        for (let child of current.getSuccessors()) {
            generated++;
            if (child.depth > maxDepth) maxDepth = child.depth;

            let childCost = child.cost;
            if (!bestCost.has(child.str) || childCost < bestCost.get(child.str)) {
                bestCost.set(child.str, childCost);
                let priority = childCost + heuristicFn(child.board, goalBoard);
                pq.enqueue(child, priority);
            }
        }
    }
    yield createStatus('failed', null, pq.items.length, explored.size, generated, expanded, maxDepth);
}
