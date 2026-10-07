// UI Controller

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const manualInitialInput = document.getElementById('manual-initial');
    const manualGoalInput = document.getElementById('manual-goal');
    const btnSetManual = document.getElementById('btn-set-manual');
    const btnGenerateRandom = document.getElementById('btn-generate-random');
    
    const algorithmSelect = document.getElementById('algorithm-select');
    const dlsOptions = document.getElementById('dls-options');
    const depthLimitInput = document.getElementById('depth-limit');
    const heuristicOptions = document.getElementById('heuristic-options');
    const heuristicSelect = document.getElementById('heuristic-select');
    
    const btnRun = document.getElementById('btn-run');
    const btnPause = document.getElementById('btn-pause');
    const btnResume = document.getElementById('btn-resume');
    const btnReset = document.getElementById('btn-reset');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const speedControl = document.getElementById('speed-control');
    const speedLabel = document.getElementById('speed-label');
    
    const boardInitial = document.getElementById('board-initial');
    const boardGoal = document.getElementById('board-goal');
    const boardMain = document.getElementById('board-main');
    const statusMessage = document.getElementById('status-message');
    
    // Stats Elements
    const statGenerated = document.getElementById('stat-generated');
    const statExpanded = document.getElementById('stat-expanded');
    const statFrontier = document.getElementById('stat-frontier');
    const statExplored = document.getElementById('stat-explored');
    const statDepth = document.getElementById('stat-depth');
    const statCost = document.getElementById('stat-cost');
    const heuristicStatPanel = document.getElementById('heuristic-stat-panel');
    const statHeuristic = document.getElementById('stat-heuristic');
    
    const solutionSummary = document.getElementById('solution-summary');
    
    // State Variables
    let initialBoard = [2, 8, 3, 1, 6, 4, 7, 0, 5];
    let goalBoard = [1, 2, 3, 8, 0, 4, 7, 6, 5];
    
    let searchGenerator = null;
    let isRunning = false;
    let delay = parseInt(speedControl.value);
    let animationTimer = null;
    let executionStartTime = 0;
    
    let stateHistory = []; // For Prev/Next step
    let historyIndex = -1;
    
    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-link');
    const pageSections = document.querySelectorAll('.page-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            pageSections.forEach(sec => sec.classList.add('hidden'));
            document.getElementById(targetId).classList.remove('hidden');
        });
    });
    
    // Navigation to Solver
    document.getElementById('btn-go-solver').addEventListener('click', () => {
        pageSections.forEach(sec => sec.classList.add('hidden'));
        document.getElementById('solver-section').classList.remove('hidden');
    });

    // Rendering Boards
    function renderBoard(container, board, animated = false, movedTile = null) {
        if (animated) {
            container.classList.add('absolute-mode');
            
            if (container.children.length === 0) {
                for (let i = 0; i < 9; i++) {
                    const tile = document.createElement('div');
                    tile.className = 'tile';
                    tile.dataset.val = i;
                    if (i === 0) {
                        tile.classList.add('empty');
                    } else {
                        tile.textContent = i;
                    }
                    container.appendChild(tile);
                }
            }
            
            const isMini = container.classList.contains('mini');
            const tileSize = isMini ? 34 : 100;
            const gap = isMini ? 2 : 4;
            const padding = isMini ? 2 : 4;
            
            // clear highlights
            Array.from(container.children).forEach(child => child.classList.remove('highlight-move'));
            
            board.forEach((val, index) => {
                const row = Math.floor(index / 3);
                const col = index % 3;
                const x = padding + col * (tileSize + gap);
                const y = padding + row * (tileSize + gap);
                
                const tile = container.querySelector(`[data-val="${val}"]`);
                if (tile) {
                    tile.style.transform = `translate(${x}px, ${y}px)`;
                    if (movedTile !== null && val === movedTile) {
                        tile.classList.add('highlight-move');
                    }
                }
            });
        } else {
            container.classList.remove('absolute-mode');
            container.innerHTML = '';
            board.forEach((val) => {
                const tile = document.createElement('div');
                tile.className = 'tile';
                if (val === 0) {
                    tile.classList.add('empty');
                } else {
                    tile.textContent = val;
                }
                container.appendChild(tile);
            });
        }
    }

    function initBoards() {
        renderBoard(boardInitial, initialBoard);
        renderBoard(boardGoal, goalBoard);
        renderBoard(boardMain, initialBoard, true);
        resetUI();
    }
    
    // Input Handlers
    btnSetManual.addEventListener('click', () => {
        const initArr = manualInitialInput.value.split(',').map(s => parseInt(s.trim()));
        const goalArr = manualGoalInput.value.split(',').map(s => parseInt(s.trim()));
        
        if (initArr.length === 9 && goalArr.length === 9 && !initArr.includes(NaN) && !goalArr.includes(NaN)) {
            if (!isSolvable(initArr, goalArr)) {
                alert("Warning: This puzzle configuration is not solvable!");
                return;
            }
            initialBoard = initArr;
            goalBoard = goalArr;
            initBoards();
        } else {
            alert('Please enter valid comma-separated 9 numbers (0-8)');
        }
    });
    
    btnGenerateRandom.addEventListener('click', () => {
        initialBoard = generateRandomSolvable(goalBoard);
        manualInitialInput.value = initialBoard.join(',');
        initBoards();
    });
    
    // Algorithm Selection Handlers
    algorithmSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        dlsOptions.classList.add('hidden');
        heuristicOptions.classList.add('hidden');
        heuristicStatPanel.classList.add('hidden');
        
        if (val === 'DLS') {
            dlsOptions.classList.remove('hidden');
        } else if (val === 'GBFS' || val === 'ASTAR') {
            heuristicOptions.classList.remove('hidden');
            heuristicStatPanel.classList.remove('hidden');
        }
    });
    
    speedControl.addEventListener('input', (e) => {
        delay = parseInt(e.target.value);
        speedLabel.textContent = delay + 'ms';
    });
    
    // Core Execution Logic
    function resetUI() {
        stopAnimation();
        searchGenerator = null;
        stateHistory = [];
        historyIndex = -1;
        
        btnRun.disabled = false;
        btnPause.disabled = true;
        btnResume.disabled = true;
        btnPrev.disabled = true;
        btnNext.disabled = true;
        
        statGenerated.textContent = '0';
        statExpanded.textContent = '0';
        statFrontier.textContent = '0';
        statExplored.textContent = '0';
        statDepth.textContent = '0';
        statCost.textContent = '0';
        statHeuristic.textContent = '-';
        
        solutionSummary.classList.add('hidden');
        statusMessage.innerHTML = '<span class="text-gray-600 font-semibold">Ready to solve</span>';
        boardMain.classList.remove('smooth-sliding');
        renderBoard(boardMain, initialBoard, true);
    }
    
    function updateStatsPanel(result) {
        statGenerated.textContent = result.nodesGenerated || 0;
        statExpanded.textContent = result.nodesExpanded || 0;
        statFrontier.textContent = result.frontierSize || 0;
        statExplored.textContent = result.exploredSize || 0;
        statDepth.textContent = result.current ? result.current.depth : 0;
        statCost.textContent = result.current ? result.current.cost : 0;
        
        let movedTile = null;
        if (result.current && result.current.parent) {
            const parentBlankIdx = result.current.parent.board.indexOf(0);
            movedTile = result.current.board[parentBlankIdx];
        }
        
        if (result.h !== null && result.h !== undefined) {
            statHeuristic.textContent = `h(n): ${result.h} | f(n): ${result.f}`;
        }
        
        if (result.current) {
            renderBoard(boardMain, result.current.board, true, movedTile);
        }
    }
    
    function showSummary(result, time) {
        solutionSummary.classList.remove('hidden');
        const found = result.status === 'success';
        
        document.getElementById('sum-status').textContent = found ? "Solution Found!" : "Not Found (Failed)";
        document.getElementById('sum-time').textContent = time.toFixed(2);
        
        if (found && result.current) {
            const path = result.current.getPath();
            document.getElementById('sum-moves').textContent = path.length - 1;
            document.getElementById('sum-cost').textContent = result.current.cost;
        } else {
            document.getElementById('sum-moves').textContent = "-";
            document.getElementById('sum-cost').textContent = "-";
        }
        
        document.getElementById('sum-generated').textContent = result.nodesGenerated;
        document.getElementById('sum-expanded').textContent = result.nodesExpanded;
        document.getElementById('sum-max-depth').textContent = result.maxDepth;
        document.getElementById('sum-memory').textContent = '~' + (result.exploredSize * 100) + ' B'; 
        
        if (found && result.current) {
            statusMessage.innerHTML = '<span class="text-brand-green font-bold animate-pulse">Animating Solution...</span>';
            animateSolutionPath(result.current.getPath());
        } else {
            statusMessage.innerHTML = '<span class="text-red-600 font-bold">Search Failed or Limit Reached</span>';
        }
    }
    
    function animateSolutionPath(pathArr) {
        stopAnimation();
        
        // Skip animation only if the path is extremely long (e.g. DFS) to prevent browser lockup
        if (pathArr.length > 200) {
            boardMain.classList.remove('smooth-sliding');
            renderBoard(boardMain, pathArr[pathArr.length - 1].board, true);
            statusMessage.innerHTML = '<span class="text-brand-green font-bold">Solution Path Complete (Animation Skipped)</span>';
            return;
        }

        // Snap to initial state instantly without animation
        boardMain.classList.remove('smooth-sliding');
        renderBoard(boardMain, pathArr[0].board, true);
        
        // Force reflow to ensure the instant snap is rendered before adding the transition class
        void boardMain.offsetWidth;
        
        // Enable smooth sliding
        boardMain.classList.add('smooth-sliding');
        
        let i = 1;
        
        function step() {
            if (i >= pathArr.length) {
                statusMessage.innerHTML = '<span class="text-brand-green font-bold">Solution Path Complete</span>';
                return;
            }
            renderBoard(boardMain, pathArr[i].board, true);
            i++;
            animationTimer = setTimeout(step, 400); // fixed slower speed for path animation
        }
        
        // Start playing the sequence
        animationTimer = setTimeout(step, 500);
    }
    
    function stepForward(skipDOM = false) {
        if (!searchGenerator) return false;
        
        if (historyIndex < stateHistory.length - 1) {
            // we are looking at history, step forward in history
            historyIndex++;
            if (!skipDOM) updateStatsPanel(stateHistory[historyIndex]);
            btnPrev.disabled = false;
            if (historyIndex === stateHistory.length - 1) {
                btnNext.disabled = false; // can generate new step
            }
            return true;
        }
        
        // generate next step
        const result = searchGenerator.next();
        if (result.done || result.value.status === 'success' || result.value.status === 'failed') {
            stopAnimation();
            const time = performance.now() - executionStartTime;
            if (result.value) {
                if (!skipDOM) updateStatsPanel(result.value);
                stateHistory.push(result.value);
                historyIndex++;
                showSummary(result.value, time);
            }
            btnRun.disabled = false;
            btnNext.disabled = true;
            return false;
        } else {
            if (!skipDOM) updateStatsPanel(result.value);
            stateHistory.push(result.value);
            historyIndex++;
            btnPrev.disabled = false;
            return true;
        }
    }
    
    function stepBackward() {
        if (historyIndex > 0) {
            historyIndex--;
            updateStatsPanel(stateHistory[historyIndex]);
            btnNext.disabled = false;
        }
        if (historyIndex === 0) {
            btnPrev.disabled = true;
        }
    }
    
    function startAnimation() {
        if (isRunning) return;
        isRunning = true;
        btnPause.disabled = false;
        btnResume.disabled = true;
        btnRun.disabled = true;
        btnNext.disabled = true;
        btnPrev.disabled = true;
        
        function loop() {
            if (!isRunning) return;
            
            if (delay === 0) {
                // Batch processing for 0ms delay to rapidly advance without freezing UI
                const frameStart = performance.now();
                let running = true;
                while (running && (performance.now() - frameStart < 15)) {
                    running = stepForward(true); // skip DOM updates while batching
                }
                
                // Update DOM once per frame
                if (historyIndex >= 0 && stateHistory[historyIndex]) {
                    updateStatsPanel(stateHistory[historyIndex]);
                }
                
                if (isRunning && running) {
                    animationTimer = setTimeout(loop, 0);
                }
            } else {
                stepForward();
                if (isRunning) {
                    animationTimer = setTimeout(loop, delay);
                }
            }
        }
        loop();
    }
    
    function stopAnimation() {
        isRunning = false;
        clearTimeout(animationTimer);
        btnPause.disabled = true;
        btnResume.disabled = false;
        btnNext.disabled = false;
        btnPrev.disabled = historyIndex <= 0;
    }
    
    // Control Button Listeners
    btnRun.addEventListener('click', () => {
        resetUI();
        const algo = algorithmSelect.value;
        const limit = parseInt(depthLimitInput.value);
        const heuris = heuristicSelect.value === 'manhattan' ? Heuristics.manhattanDistance : Heuristics.misplacedTiles;
        
        switch (algo) {
            case 'BFS': searchGenerator = bfs(initialBoard, goalBoard); break;
            case 'DFS': searchGenerator = dfs(initialBoard, goalBoard); break;
            case 'DLS': searchGenerator = dls(initialBoard, goalBoard, limit); break;
            case 'IDDLS': searchGenerator = iddls(initialBoard, goalBoard, limit || 20); break;
            case 'GBFS': searchGenerator = gbfs(initialBoard, goalBoard, heuris); break;
            case 'ASTAR': searchGenerator = astar(initialBoard, goalBoard, heuris); break;
        }
        
        executionStartTime = performance.now();
        statusMessage.innerHTML = '<span class="text-blue-600 font-bold animate-pulse">Searching...</span>';
        startAnimation();
    });
    
    btnPause.addEventListener('click', stopAnimation);
    btnResume.addEventListener('click', startAnimation);
    btnNext.addEventListener('click', stepForward);
    btnPrev.addEventListener('click', stepBackward);
    btnReset.addEventListener('click', resetUI);
    
    // Initialization
    initBoards();
    
    
    // --- Comparison Page Logic ---
    const btnRunComparison = document.getElementById('btn-run-comparison');
    const comparisonTbody = document.getElementById('comparison-tbody');
    
    btnRunComparison.addEventListener('click', () => {
        comparisonTbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Running comparisons... (This may take a moment for uninformed searches on hard puzzles)</td></tr>';
        
        // Use timeout to allow UI to render the "Running..." message
        setTimeout(() => {
            const algorithms = [
                { name: 'BFS', func: () => simulate(bfs(initialBoard, goalBoard)) },
                { name: 'DFS', func: () => simulate(dfs(initialBoard, goalBoard)) },
                { name: 'DLS (Depth 20)', func: () => simulate(dls(initialBoard, goalBoard, 20)) },
                { name: 'IDDLS (Limit 20)', func: () => simulate(iddls(initialBoard, goalBoard, 20)) },
                { name: 'GBFS (Manhattan)', func: () => simulate(gbfs(initialBoard, goalBoard, Heuristics.manhattanDistance)) },
                { name: 'A* (Manhattan)', func: () => simulate(astar(initialBoard, goalBoard, Heuristics.manhattanDistance)) }
            ];
            
            comparisonTbody.innerHTML = '';
            
            algorithms.forEach(algo => {
                const startTime = performance.now();
                const result = algo.func();
                const time = performance.now() - startTime;
                
                const tr = document.createElement('tr');
                tr.className = 'border-b';
                
                let found = result.status === 'success';
                let moves = found && result.current ? result.current.pathLength : '-';
                
                tr.innerHTML = `
                    <td class="p-3">${algo.name}</td>
                    <td class="p-3 font-semibold ${found ? 'text-green-600' : 'text-red-600'}">${found ? 'Yes' : 'No'}</td>
                    <td class="p-3">${result.nodesExpanded}</td>
                    <td class="p-3">${moves}</td>
                    <td class="p-3">${time.toFixed(2)} ms</td>
                    <td class="p-3">~${result.exploredSize * 100} B</td>
                `;
                comparisonTbody.appendChild(tr);
            });
            
        }, 100);
    });
    
    function simulate(generator) {
        // Runs a generator to completion synchronously
        let result = generator.next();
        let lastVal = null;
        // Limit iterations to prevent browser lockup on impossible deep DFS
        let iterations = 0; 
        while (!result.done && result.value.status === 'running') {
            iterations++;
            if (iterations > 500000) { // Increased safety break to allow full DFS
                break;
            }
            result = generator.next();
        }
        
        lastVal = result.value;
        if (lastVal.current) {
            // Cache path length so we don't hold onto the path object unnecessarily 
            // but we can report it
            lastVal.current.pathLength = lastVal.current.getPath().length - 1;
        }
        return lastVal;
    }

});
