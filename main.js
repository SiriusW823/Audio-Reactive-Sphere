// AudioContext initialization fix for GitHub Pages and browser autoplay restrictions
// This version ensures AudioContext is created or resumed only after user interaction

async function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
    }

    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log('AudioContext resumed after user gesture');
        } catch (err) {
            console.warn('Failed to resume AudioContext:', err);
        }
    }
}

// Automatically resume audio context on first user click
document.addEventListener('click', async () => {
    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('AudioContext auto-resumed on first click');
    }
}, { once: true });

// Modify buttons to ensure audio starts only after user interaction
playPause.addEventListener('click', async () => {
    await ensureAudioContext();
    togglePlay();
});

inputToggle.addEventListener('click', async () => {
    await ensureAudioContext();
    toggleInput();
});

// Updated toggleInput() function with AudioContext safety
async function toggleInput() {
    await ensureAudioContext();

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
    }

    await audioContext.resume();

    if (usingMic) {
        usingMic = false;
        inputToggle.textContent = 'Use Mic';
        songSelect.disabled = false;
        playPause.disabled = false;
        volumeControl.disabled = false;
        timelineControl.disabled = false;

        if (micSource) {
            micSource.disconnect();
            micSource = null;
        }

        if (sourceNode) {
            sourceNode.connect(analyser);
        }
        analyser.connect(audioContext.destination);

    } else {
        usingMic = true;
        inputToggle.textContent = 'Use Player';
        songSelect.disabled = true;
        playPause.disabled = true;
        volumeControl.disabled = true;
        timelineControl.disabled = true;

        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                }
            });

            if (sourceNode) {
                sourceNode.disconnect();
            }

            micSource = audioContext.createMediaStreamSource(micStream);
            micSource.connect(analyser);
            analyser.disconnect(audioContext.destination);

            console.log('Microphone is active');

        } catch (error) {
            console.error('Microphone access failed:', error.name, error.message);
            usingMic = false;
            inputToggle.textContent = 'Use Mic';
        }
    }
}

// Optional: Add this to index.html for clarity to users
// <div id="tapPrompt">Click anywhere to enable audio</div>
// <script>
//   document.addEventListener('click', () => {
//     document.getElementById('tapPrompt')?.remove();
//   }, { once: true });
// </script>
