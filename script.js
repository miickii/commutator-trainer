let commutators = [];
let threshold = 4;
let numPairsPerStep = 1;
let mode = 'edge';
let showCommutator = false;
let currentStep = 0;
let totalSteps = 0;
let results = [];
let toRepeat = [];
let timerInterval = null;
let startTime = null;
let waitingForSecondAction = false;
let sessionActive = true; // Flag to Track if Session is Active

// DOM Elements
const startScreen = document.getElementById('start-screen');
const practiceScreen = document.getElementById('practice-screen');
const startForm = document.getElementById('start-form');
const progressBar = document.getElementById('progress-bar');
const pairDisplay = document.getElementById('pair-display');
const timerDisplay = document.getElementById('timer');
const instructions = document.getElementById('instructions');
const nextButton = document.getElementById('next-button');

// Event Listeners
startForm.addEventListener('submit', startPractice);
nextButton.addEventListener('click', handleNext);

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
            results = [];
            toRepeat = [];
            sessionActive = true; // Reset Session Flag

            // Show Practice Screen
            startScreen.classList.remove('active');
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
    nextButton.style.display = 'none';
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
        instructions.textContent = 'Press Spacebar (or "Next" button) to display commutator.';
    } else {
        instructions.textContent = 'Press Spacebar (or "Next" button) to move to the next step.';
    }
}

// Function to Start Timer
function startTimer() {
    // Ensure any existing timer is stopped
    stopTimer();

    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);
    console.log("\nTimer started at: " + startTime)
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

// Function to Stop Timer
function stopTimer() {
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Function to Handle Spacebar Press or Next Button Click
function handleNext() {
    if (!sessionActive) return; // Ignore if session has ended

    if (showCommutator) {
        if (!waitingForSecondAction) {
            // Show Commutator
            stopTimer();
            recordResult();
            displayCommutator();
            waitingForSecondAction = true;
            instructions.textContent = 'Press Next to move to the next step.';
            nextButton.style.display = 'inline-block';
        } else {
            // Record Result and Move to Next Step
            currentStep++;
            showNextStep();
            startTimer();
        }
    } else {
        // Single Action: Stop Timer and Move to Next Step
        if (timerInterval === null) return; // Prevent action if timer is not running
        stopTimer();
        recordResult();
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
function recordResult() {
    if (startTime === null) return; // Ensure startTime is valid

    const elapsed = (Date.now() - startTime) / 1000; // in seconds
    const startIdx = currentStep * numPairsPerStep;
    const endIdx = startIdx + numPairsPerStep;
    const currentPairs = commutators.slice(startIdx, endIdx);
    console.log(elapsed.toFixed(2), currentPairs);

    currentPairs.forEach(comm => {
        results.push({ pair: comm.pair, time: elapsed.toFixed(2) });
        if (elapsed > threshold) {
            toRepeat.push(comm);
        }
    });

    // Reset startTime to prevent accidental reuse
    startTime = null;
}

// Function to End Training
function endTraining() {
    sessionActive = false; // Set Session Flag to False
    stopTimer(); // Ensure Timer is Stopped
    progressBar.value = totalSteps;
    instructions.textContent = 'Training Completed!';
    pairDisplay.innerHTML = generateStatistics();
    nextButton.style.display = 'none';

    // Optionally, Prompt to Repeat Challenging Pairs
    if (toRepeat.length > 0) {
        const repeat = confirm(`Training Completed!\n\nDo you want to repeat the ${toRepeat.length} pairs that exceeded ${threshold} seconds?`);
        if (repeat) {
            commutators = shuffleArray(toRepeat);
            totalSteps = Math.ceil(commutators.length / numPairsPerStep);
            progressBar.max = totalSteps;
            progressBar.value = 0;
            currentStep = 0;
            results = [];
            toRepeat = [];
            sessionActive = true; // Reactivate Session
            showNextStep();
            startTimer();
            return;
        }
    }

}

// Function to Generate Statistics
function generateStatistics() {
    if (results.length === 0) {
        return "No commutators completed.";
    }

    const times = results.map(r => parseFloat(r.time));
    const avgTime = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
    const medianTime = calculateMedian(times).toFixed(2);
    const minTime = Math.min(...times).toFixed(2);
    const maxTime = Math.max(...times).toFixed(2);

    return `
        <h2>Training Completed!</h2>
        <p>Total Pairs: ${results.length}</p>
        <p>Average Time: ${avgTime} seconds</p>
        <p>Median Time: ${medianTime} seconds</p>
        <p>Minimum Time: ${minTime} seconds</p>
        <p>Maximum Time: ${maxTime} seconds</p>
    `;
}
// Function to Calculate Median
function calculateMedian(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}