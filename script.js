// script.js

// Global Variables
let commutators = [];
let threshold = 4;
let numPairsPerStep = 1;
let mode = 'edge';
let showCommutator = false;
let currentStep = 0;
let totalSteps = 0;
let results = {}; // Object to track best times per pair
let masterResults = {}; // Object to track cumulative best times across all sessions
let toRepeat = [];
let timerInterval = null;
let startTime = null;
let waitingForSecondAction = false;
let sessionActive = false; // Initialize to false to prevent unintended triggers

// DOM Elements
const startScreen = document.getElementById('start-screen');
const practiceScreen = document.getElementById('practice-screen');
const endScreen = document.getElementById('end-screen');
const startForm = document.getElementById('start-form');
const progressBar = document.getElementById('progress-bar');
const pairDisplay = document.getElementById('pair-display');
const timerDisplay = document.getElementById('timer');
const instructions = document.getElementById('instructions');
const nextButton = document.getElementById('next-button');
const statisticsDiv = document.getElementById('statistics');
const restartButton = document.getElementById('restart-button');

// Event Listeners
startForm.addEventListener('submit', startPractice);
nextButton.addEventListener('click', handleNext);
restartButton.addEventListener('click', restartSession);

// Function to Start Practice
function startPractice(event) {
    event.preventDefault();

    // Get Form Values
    mode = document.querySelector('input[name="commutator-type"]:checked').value;
    const letters = document.getElementById('letters').value.trim().toUpperCase();
    threshold = parseFloat(document.getElementById('threshold').value);
    numPairsPerStep = parseInt(document.getElementById('num-pairs').value);
    showCommutator = document.getElementById('show-comm').checked;

    // Input Validation
    if (!/^[A-Z]+$/.test(letters)) {
        alert('Please enter valid starting letters containing only A-Z.');
        return;
    }

    if (isNaN(threshold) || threshold <= 0) {
        alert('Please enter a valid positive number for the time threshold.');
        return;
    }

    if (isNaN(numPairsPerStep) || numPairsPerStep <= 0) {
        alert('Please enter a valid positive integer for the number of pairs per step.');
        return;
    }

    const startingLetters = new Set(letters);

    // Load Commutators
    const jsonFile = mode === 'edge' ? 'processed_edge_commutators.json' : 'processed_corner_commutators.json';

    fetch(jsonFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${jsonFile}`);
            }
            return response.json();
        })
        .then(data => {
            commutators = Object.keys(data)
                .filter(key => startingLetters.has(key[0].toUpperCase()))
                .map(key => ({
                    pair: key,
                    setup: data[key].setup || 'N/A',
                    algorithm: data[key].algorithm || 'N/A',
                    words: data[key].words || 'N/A',
                    commutator: data[key].commutator || 'N/A'
                }));

            if (commutators.length === 0) {
                alert(`No commutators found starting with letters: ${Array.from(startingLetters).join(', ')}`);
                return;
            }

            if (numPairsPerStep > commutators.length) {
                alert(`Number of pairs per step (${numPairsPerStep}) exceeds total available pairs (${commutators.length}). All pairs will be shown in one step.`);
                numPairsPerStep = commutators.length;
            }

            // Initialize Training Data
            commutators = shuffleArray(commutators);
            totalSteps = Math.ceil(commutators.length / numPairsPerStep);
            progressBar.max = totalSteps;
            progressBar.value = 0;
            currentStep = 0;
            results = {}; // Reset results for the current session
            toRepeat = [];
            sessionActive = true; // Activate session

            // Show Practice Screen
            startScreen.classList.remove('active');
            endScreen.classList.remove('active');
            practiceScreen.classList.add('active');

            // Start First Step
            showNextStep();
            startTimer();
        })
        .catch(error => {
            alert(error.message);
        });
}

// Function to Shuffle Array
function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

// Function to Show Next Step
function showNextStep() {
    if (currentStep >= totalSteps) {
        endTraining();
        return;
    }

    // Clear Previous Display
    pairDisplay.innerHTML = '';
    instructions.innerHTML = '';
    nextButton.classList.remove('visible'); // Hide button smoothly
    waitingForSecondAction = false;

    // Determine Pairs for Current Step
    const startIdx = currentStep * numPairsPerStep;
    const endIdx = startIdx + numPairsPerStep;
    const currentPairs = commutators.slice(startIdx, endIdx);

    // Display Each Pair or Words
    currentPairs.forEach(comm => {
        const displayText = mode === 'edge' ? comm.pair : comm.words;
        const pairElement = document.createElement('div');
        pairElement.classList.add('pair');
        pairElement.textContent = displayText;
        pairDisplay.appendChild(pairElement);
    });

    // Update Progress Bar
    progressBar.value = currentStep;

    // Update Instructions
    if (showCommutator) {
        instructions.textContent = 'Tap anywhere on the screen or press "Next" to display commutator.';
    } else {
        instructions.textContent = 'Tap anywhere on the screen or press "Next" to move to the next step.';
    }
}

// Function to Start Timer
function startTimer() {
    if (timerInterval) return; // Prevent multiple timers
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 10); // Update every 10 milliseconds for higher precision
}

// Function to Update Timer Display
function updateTimer() {
    if (!sessionActive) return; // Prevent Timer Update if Session Ended

    const elapsed = (Date.now() - startTime) / 1000; // in seconds
    const minutes = Math.floor(elapsed / 60);
    const seconds = (elapsed % 60).toFixed(2);
    timerDisplay.textContent = `${pad(minutes)}:${pad(seconds)}`;

    // Update Timer Color Based on Threshold
    if (elapsed < threshold) {
        timerDisplay.style.color = 'green';
    } else if (elapsed < threshold * 1.5) {
        timerDisplay.style.color = 'orange';
    } else {
        timerDisplay.style.color = 'red';
    }
}

// Function to Pad Numbers with Leading Zeros
function pad(num) {
    return num.toString().padStart(2, '0');
}

// Function to Stop Timer and Return Elapsed Time
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        const elapsed = (Date.now() - startTime) / 1000; // in seconds
        return elapsed;
    }
    return 0;
}

// Function to Handle Spacebar Press, Next Button Click, and Touch Events
function handleNext() {
    if (!sessionActive) return; // Ignore if session has ended

    if (showCommutator) {
        if (!waitingForSecondAction) {
            // First action: stop timer, record result, show commutator
            const elapsed = stopTimer();
            recordResult(elapsed);
            displayCommutator();
            waitingForSecondAction = true;
            instructions.textContent = 'Press "Next" or tap anywhere to move to the next step.';
            nextButton.classList.add('visible'); // Show button smoothly
        } else {
            // Second action: move to next step
            currentStep++;
            showNextStep();
            startTimer();
            nextButton.classList.remove('visible'); // Hide button smoothly
        }
    } else {
        // Single Action: stop timer, record result, move to next step
        const elapsed = stopTimer();
        recordResult(elapsed);
        currentStep++;
        showNextStep();
        startTimer();
    }
}

// Function to Handle Spacebar Press
document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
        event.preventDefault(); // Prevent default spacebar scrolling
        handleNext();
    }
});

// Function to Handle Touch Events on Mobile (Attach to Practice Screen Only)
practiceScreen.addEventListener('touchstart', function(event) {
    event.preventDefault(); // Prevent default touch actions
    handleNext();
}, { passive: false });

// Function to Display Commutator
function displayCommutator() {
    const startIdx = currentStep * numPairsPerStep;
    const endIdx = startIdx + numPairsPerStep;
    const currentPairs = commutators.slice(startIdx, endIdx);

    pairDisplay.innerHTML = '';
    currentPairs.forEach(comm => {
        const commText = comm.commutator;
        const commElement = document.createElement('div');
        commElement.classList.add('commutator');
        commElement.textContent = commText;
        commElement.style.color = '#00FF00'; // Green color
        pairDisplay.appendChild(commElement);
    });
}

// Function to Record Results
function recordResult(elapsed) {
    const currentPairs = commutators.slice(currentStep * numPairsPerStep, currentStep * numPairsPerStep + numPairsPerStep);

    currentPairs.forEach(comm => {
        // Update masterResults with the best (minimum) time
        if (!masterResults[comm.pair] || elapsed < masterResults[comm.pair]) {
            masterResults[comm.pair] = elapsed.toFixed(2); // Store best time
        }

        // Queue for repetition if exceeded threshold and not already in queue
        if (elapsed > threshold) {
            if (!toRepeat.find(c => c.pair === comm.pair)) {
                toRepeat.push(comm);
            }
        }
    });
}

// Function to End Training
function endTraining() {
    sessionActive = false; // Set Session Flag to False
    stopTimer(); // Ensure Timer is Stopped
    progressBar.value = totalSteps;
    practiceScreen.classList.remove('active');
    endScreen.classList.add('active');

    // Generate and Display Statistics
    statisticsDiv.innerHTML = generateStatistics();

    // Optionally, Prompt to Repeat Challenging Pairs
    if (toRepeat.length > 0) {
        const repeat = confirm(`Training Completed!\n\nDo you want to repeat the ${toRepeat.length} pairs that exceeded ${threshold} seconds?`);
        if (repeat) {
            commutators = shuffleArray(toRepeat);
            totalSteps = Math.ceil(commutators.length / numPairsPerStep);
            progressBar.max = totalSteps;
            progressBar.value = 0;
            currentStep = 0;
            toRepeat = [];
            sessionActive = true; // Reactivate Session
            practiceScreen.classList.add('active'); // Activate Practice Screen Correctly
            endScreen.classList.remove('active');
            // Display the repeated pairs
            showNextStep();
            startTimer();
            return;
        }
    }
}

// Function to Generate Statistics
function generateStatistics() {
    const totalPairs = Object.keys(masterResults).length;
    if (totalPairs === 0) {
        return "<p>No commutators completed.</p>";
    }

    const times = Object.values(masterResults).map(time => parseFloat(time));
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
    const medianTime = calculateMedian(times).toFixed(2);
    const minTime = Math.min(...times).toFixed(2);
    const maxTime = Math.max(...times).toFixed(2);

    let statsHTML = `
        <p><strong>Total Pairs:</strong> ${totalPairs}</p>
        <p><strong>Average Time:</strong> ${avgTime} seconds</p>
        <p><strong>Median Time:</strong> ${medianTime} seconds</p>
        <p><strong>Minimum Time:</strong> ${minTime} seconds</p>
        <p><strong>Maximum Time:</strong> ${maxTime} seconds</p>
        <h3>Individual Pair Times:</h3>
        <ul>
    `;

    for (const [pair, time] of Object.entries(masterResults)) {
        statsHTML += `<li>${pair}: ${time} seconds</li>`;
    }

    statsHTML += `</ul>`;

    return statsHTML;
}

// Function to Calculat