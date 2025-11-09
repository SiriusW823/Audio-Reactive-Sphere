import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';
import { AudioLoader, AudioListener, Audio, AudioAnalyser } from 'https://unpkg.com/three@0.136.0/build/three.module.js';
import * as dat from 'https://cdn.jsdelivr.net/npm/dat.gui/build/dat.gui.module.js';

console.log('Script started');

// Cleanup function
function cleanupPreviousElements() {
    const elementsToRemove = [
        '#songSelect', '#playPause', '#volume', 
        'button', 'select', '.dg.main', 'canvas', '.controls-container',
        '#volumeControl', '#audioControls', '.audio-control'
    ];
    
    elementsToRemove.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
            if (selector !== '#presetContainer') {
                element.remove();
            }
        });
    });
    
    document.querySelectorAll('div').forEach(div => {
        if ((div.id?.includes('control') || 
            div.className?.includes('control') ||
            div.id?.includes('audio') ||
            div.className?.includes('audio')) && 
            div.id !== 'presetContainer') {
            div.remove();
        }
    });
}

cleanupPreviousElements();
console.log('Cleanup completed');

// Fixed position GUI and presets
const guiAndPresetsStyleFix = document.createElement('style');
guiAndPresetsStyleFix.textContent = `
    /* Fixed position GUI spheres */
    .dg.main {
        position: absolute !important;
        top: 10px !important;
        right: 10px !important;
        z-index: 1000 !important;
    }

    #presetContainer {
        position: fixed !important;
        top: 10px !important; 
        left: 10px !important;
        z-index: 1000 !important; 
        display: flex !important; 
        gap: 10px !important; 
    }

    #presetContainer input[type="text"] {
        flex: 1 1 auto;
        min-width: 150px;
        padding: 5px;
        border-radius: 3px;
    }

    #presetContainer select, 
    #presetContainer button {
        flex: 0 0 auto;
        padding: 5px;
        border-radius: 3px;
    }
`;
document.head.appendChild(guiAndPresetsStyleFix);

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2.5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

console.log('Scene and renderer initialized');

// Audio setup
let audioContext;
let analyser;
let audioElement;
let sourceNode = null;
let micStream;
let micSource = null;

// Audio Controls Container
const controls = document.createElement('div');
controls.style.cssText = 'position: absolute; top: 10px; right: 310px; z-index: 1000; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;';
document.body.appendChild(controls);

const audioControls = document.createElement('div');
audioControls.style.cssText = 'display: flex; align-items: center; gap: 10px;';
controls.appendChild(audioControls);

const songSelect = document.createElement('select');
songSelect.style.cssText = 'padding: 5px; border-radius: 3px; background: #333; color: white; border: 1px solid #666;';
audioControls.appendChild(songSelect);

const playPause = document.createElement('button');
playPause.textContent = 'Play';
playPause.style.cssText = 'padding: 5px 15px; border-radius: 3px; background: #444; color: white; border: 1px solid #666;';
audioControls.appendChild(playPause);

const volumeControl = document.createElement('input');
volumeControl.type = 'range';
volumeControl.min = 0;
volumeControl.max = 1;
volumeControl.step = 0.1;
volumeControl.value = 0.5;
volumeControl.style.width = '100px';
audioControls.appendChild(volumeControl);

const timelineControl = document.createElement('input');
timelineControl.type = 'range';
timelineControl.min = 0;
timelineControl.max = 100;
timelineControl.step = 1;
timelineControl.value = 0;
timelineControl.style.width = '200px';  
timelineControl.style.marginLeft = '10px';
audioControls.appendChild(timelineControl);

const inputToggle = document.createElement('button');
inputToggle.textContent = 'Use Mic';
inputToggle.style.cssText = 'padding: 5px 15px; border-radius: 3px; background: #444; color: white; border: 1px solid #666; margin-left: 10px;';
audioControls.appendChild(inputToggle);

let usingMic = false;
inputToggle.onclick = toggleInput;

playPause.onclick = togglePlay;
songSelect.onchange = changeSong;

console.log('Controls created');

// Noise generator
const noise = {
    p: new Array(256).fill(0).map((_, i) => i),
    perm: new Array(512),
    
    init() {
        for (let i = this.p.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
        }
    },
    
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); },
    lerp(t, a, b) { return a + t * (b - a); },
    
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h == 12 || h == 14 ? x : z;
        return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
    },
    
    noise3D(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        
        const A = this.perm[X] + Y;
        const AA = this.perm[A] + Z;
        const AB = this.perm[A + 1] + Z;
        const B = this.perm[X + 1] + Y;
        const BA = this.perm[B] + Z;
        const BB = this.perm[B + 1] + Z;
        
        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.perm[AA], x, y, z),
                                                     this.grad(this.perm[BA], x-1, y, z)),
                                        this.lerp(u, this.grad(this.perm[AB], x, y-1, z),
                                                  this.grad(this.perm[BB], x-1, y-1, z))),
                           this.lerp(v, this.lerp(u, this.grad(this.perm[AA+1], x, y, z-1),
                                                  this.grad(this.perm[BA+1], x-1, y, z-1)),
                                     this.lerp(u, this.grad(this.perm[AB+1], x, y-1, z-1),
                                               this.grad(this.perm[BB+1], x-1, y-1, z-1))));
    }
};
noise.init();
console.log('Noise initialized');

// Beat manager
const beatManager = {
    currentWaveRadius: 0,
    waveStrength: 0,
    isWaveActive: false,
    
    triggerWave(rangeEnergy) {
        const maxEnergy = 255; 
        const energyExcess = rangeEnergy - 200; 
        this.waveStrength = (energyExcess / (maxEnergy - 200)) * 20.0;
        this.currentWaveRadius = 0;
        this.isWaveActive = true;
    },
    
    update(deltaTime) {
        if (this.isWaveActive) {
            this.currentWaveRadius += deltaTime * 1.0;
            this.waveStrength *= 0.98;
            
            if (this.currentWaveRadius > 1.0 || this.waveStrength < 0.1) {
                this.isWaveActive = false;
            }
        }
    },
    
    getWaveForce(position) {
        if (!this.isWaveActive) return 0;
        const distanceFromCenter = position.length();
        const distanceFromWave = Math.abs(distanceFromCenter - this.currentWaveRadius);
        if (distanceFromWave < 0.1) {
            return this.waveStrength * Math.exp(-distanceFromWave * 10);
        }
        return 0;
    }
};

async function toggleInput() {
    
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
            console.error("Microphone access failed:", error.name, error.message);
            usingMic = false;
            inputToggle.textContent = 'Use Mic';
        }
    }
}

async function initAudio() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
        }

        if (!usingMic) {
            if (!audioElement) {
                audioElement = document.createElement('audio');
                audioElement.crossOrigin = "anonymous";
                audioElement.volume = volumeControl.value;
            }

            try {
                if (!sourceNode) {
                    sourceNode = audioContext.createMediaElementSource(audioElement);
                    sourceNode.connect(analyser);
                    analyser.connect(audioContext.destination);
                } else {
                    sourceNode.disconnect();
                    sourceNode.connect(analyser);
                }

            } catch (error) {
                console.error("Failed to connect audio element to analyser:", error.name, error.message);
            }

            try {
                const response = await fetch('Songs/');
                const text = await response.text();
                
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                
                const files = Array.from(doc.querySelectorAll('a'))
                    .map(a => decodeURIComponent(a.href))
                    .filter(href => href.match(/\.(mp3|wav|ogg)$/i))
                    .map(href => {
                        const fileName = href.split('/').pop();
                        return {
                            path: `Songs/${fileName}`,
                            name: fileName.replace(/\.(mp3|wav|ogg)$/i, '')
                        };
                    });
                
                songSelect.innerHTML = '';
                
                files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.path;
                    option.textContent = file.name;
                    songSelect.appendChild(option);
                });
                
                if (files.length > 0 && !audioElement.src) {
                    audioElement.src = files[0].path;
                }
                
            } catch (error) {
                console.error("Failed to load song list:", error);
            }
            
            volumeControl.oninput = e => {
                if (audioElement) {
                    audioElement.volume = e.target.value;
                }
            };
            
            setupTimelineControl();
        }

        console.log('Audio initialized');
        
    } catch (error) {
        console.error("Audio initialization failed:", error);
    }
}

function getAudioData(sphere) {
    if (!analyser || (!audioContext && !usingMic)) return { 
        average: 0, 
        frequencies: new Float32Array(), 
        peakDetected: false,
        rangeEnergy: 0
    };
    
    try {
        const frequencies = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencies);
        
        const gainMultiplier = sphere.params.gainMultiplier; 
        frequencies.forEach((value, index) => {
            frequencies[index] = Math.min(value * gainMultiplier, 255);
        });

        const frequencyToIndex = (frequency) => Math.round(frequency / (audioContext.sampleRate / 2) * analyser.frequencyBinCount);

        const minFreqIndex = frequencyToIndex(sphere.params.minFrequency);
        const maxFreqIndex = frequencyToIndex(sphere.params.maxFrequency);
        const frequencyRange = frequencies.slice(minFreqIndex, maxFreqIndex + 1);
        const rangeEnergy = frequencyRange.reduce((a, b) => a + b, 0) / frequencyRange.length;

        const minFreqBeatIndex = frequencyToIndex(sphere.params.minFrequencyBeat); // Nové pásmo pro beaty
        const maxFreqBeatIndex = frequencyToIndex(sphere.params.maxFrequencyBeat);
        const frequencyRangeBeat = frequencies.slice(minFreqBeatIndex, maxFreqBeatIndex + 1);
        const rangeEnergyBeat = frequencyRangeBeat.reduce((a, b) => a + b, 0) / frequencyRangeBeat.length;

        sphere.peakDetection.energyHistory.push(rangeEnergy);
        if (sphere.peakDetection.energyHistory.length > sphere.peakDetection.historyLength) {
            sphere.peakDetection.energyHistory.shift();
        }
        
        const averageEnergy = sphere.peakDetection.energyHistory.reduce((a, b) => a + b, 0) / 
                            sphere.peakDetection.energyHistory.length;
        
        const now = performance.now();
        const peakDetected = rangeEnergy > averageEnergy * sphere.params.peakSensitivity &&
                           now - sphere.peakDetection.lastPeakTime > sphere.peakDetection.minTimeBetweenPeaks;
        
        if (peakDetected) {
            sphere.peakDetection.lastPeakTime = now;
            console.log(`Sphere ${sphere.index + 1} PEAK DETECTED! Energy: ${rangeEnergy}, Average: ${averageEnergy}`);
        }
        

        return {
            average: rangeEnergy / 255,
            frequencies,
            peakDetected,
            rangeEnergy: rangeEnergy,
            rangeEnergyBeat: rangeEnergyBeat
        };

    } catch (error) {
        console.error("Audio analysis failed:", error);
        return { 
            average: 0, 
            frequencies: new Float32Array(), 
            peakDetected: false,
            rangeEnergy: 0
        };
    }
}


function updateTimeline() {
    if (audioElement && !audioElement.paused && audioElement.duration) {
        const percent = (audioElement.currentTime / audioElement.duration) * 100;
        timelineControl.value = percent;
    }
}

function setupTimelineControl() {
    audioElement.addEventListener('loadedmetadata', () => {
        timelineControl.value = 0;
        console.log('Song duration:', audioElement.duration);
    });

    audioElement.addEventListener('timeupdate', updateTimeline);

    timelineControl.addEventListener('input', (e) => {
        if (audioElement.duration) {
            const time = (e.target.value / 100) * audioElement.duration;
            audioElement.currentTime = time;
        }
    });
}

function togglePlay() {
    if (usingMic) return; 

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (!sourceNode && audioElement) {
        try {
            sourceNode = audioContext.createMediaElementSource(audioElement);
            sourceNode.connect(analyser);
            analyser.connect(audioContext.destination);
        } catch (error) {
            console.error("Audio connection failed:", error);
            return;
        }
    }
    
    if (audioElement.paused) {
        audioElement.play()
            .then(() => playPause.textContent = 'Pause')
            .catch(error => console.error("Playback failed:", error));
    } else {
        audioElement.pause();
        playPause.textContent = 'Play';
    }
}

function changeSong() {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    audioElement.src = songSelect.value;
    audioElement.load();
    
    if (!sourceNode) {
        try {
            sourceNode = audioContext.createMediaElementSource(audioElement);
            sourceNode.connect(analyser);
            analyser.connect(audioContext.destination);
        } catch (error) {
            console.error("Audio connection failed:", error);
            return;
        }
    }
    
    audioElement.play()
        .then(() => {
            playPause.textContent = 'Pause';
            console.log("Playback started");
        })
        .catch(error => console.error("Playback failed:", error));

    timelineControl.value = 0;
}

function generateNewNoiseScale(params, lastNoiseScale) {
    if (!params.dynamicNoiseScale) {
        return params.noiseScale;
    }

    let { minNoiseScale, maxNoiseScale, noiseStep } = params;

    // --- PŘIDANÁ POJISTKA A DROBNÉ LOGY ---
    if (minNoiseScale >= maxNoiseScale) {
        console.warn(`Fixing minNoiseScale (${minNoiseScale}) >= maxNoiseScale (${maxNoiseScale}).`);
        maxNoiseScale = minNoiseScale + 0.1; // Natvrdo posunout, aby byl rozdíl aspoň 0.1
    }

    let range = maxNoiseScale - minNoiseScale;
    if (range < 0.1) {
        console.warn(`Range < 0.1 => Forcing minimal range = 0.1`);
        range = 0.1;
        maxNoiseScale = minNoiseScale + range;
    }

    if (noiseStep > range) {
        console.warn(`noiseStep (${noiseStep}) > range (${range}) => Forcing noiseStep = range / 2`);
        noiseStep = range / 2;
    }

    // LastNoiseScale valid range
    lastNoiseScale = Math.max(minNoiseScale, Math.min(lastNoiseScale, maxNoiseScale));

    const stepsUp = Math.floor((maxNoiseScale - lastNoiseScale) / noiseStep);
    const stepsDown = Math.floor((lastNoiseScale - minNoiseScale) / noiseStep);

    if (stepsUp === 0 && stepsDown === 0) {
        return lastNoiseScale;
    }

    const direction = Math.random() < 0.5 && stepsDown > 0 ? -1 : 1;
    const steps = direction === 1 
        ? Math.floor(Math.random() * (stepsUp + 1))
        : Math.floor(Math.random() * (stepsDown + 1));

    let newValue = lastNoiseScale + direction * steps * noiseStep;

    newValue = Math.max(minNoiseScale, Math.min(newValue, maxNoiseScale));

    return newValue;
}

// Reinit particles
function reinitializeParticlesForSphere(sphere, sphereParams, sphereGeometry) {
    console.log(`Reinitializing sphere ${sphere.index + 1} with ${sphereParams.particleCount} particles`);

    const newPositions = new Float32Array(sphereParams.particleCount * 3);
    const newColors = new Float32Array(sphereParams.particleCount * 3);
    const newVelocities = new Float32Array(sphereParams.particleCount * 3);
    const newBasePositions = new Float32Array(sphereParams.particleCount * 3);
    const newLifetimes = new Float32Array(sphereParams.particleCount);
    const newMaxLifetimes = new Float32Array(sphereParams.particleCount);
    const newBeatEffects = new Float32Array(sphereParams.particleCount);

    for (let i = 0; i < sphereParams.particleCount; i++) {
        const i3 = i * 3;
        const radius = THREE.MathUtils.lerp(0, sphereParams.sphereRadius, sphereParams.innerSphereRadius);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.cbrt(Math.random()) * radius;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        newPositions[i3] = x;
        newPositions[i3 + 1] = y;
        newPositions[i3 + 2] = z;

        newBasePositions[i3] = x;
        newBasePositions[i3 + 1] = y;
        newBasePositions[i3 + 2] = z;

        newVelocities[i3] = 0;
        newVelocities[i3 + 1] = 0;
        newVelocities[i3 + 2] = 0;

        const lt = Math.random() * sphereParams.particleLifetime;
        newLifetimes[i] = lt;
        newMaxLifetimes[i] = lt;

        newBeatEffects[i] = 0;
    }

    sphereGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    sphereGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));

    updateColorsForSphere(sphereParams, sphereGeometry, newColors);

    return {
        newPositions,
        newColors,
        newVelocities,
        newBasePositions,
        newLifetimes,
        newMaxLifetimes,
        newBeatEffects
    };
}

function updateColorsForSphere(sphereParams, sphereGeometry, sphereColors) {
    const color1 = new THREE.Color(sphereParams.colorStart);
    const color2 = new THREE.Color(sphereParams.colorEnd);

    for (let i = 0; i < sphereParams.particleCount; i++) {
        const t = i / sphereParams.particleCount;
        sphereColors[i * 3] = color1.r * (1 - t) + color2.r * t;
        sphereColors[i * 3 + 1] = color1.g * (1 - t) + color2.g * t;
        sphereColors[i * 3 + 2] = color1.b * (1 - t) + color2.b * t;
    }
    sphereGeometry.attributes.color.needsUpdate = true;
}

// Preset management
const presets = JSON.parse(localStorage.getItem('presets')) || {}; // Uložené presety
const defaultParams = []; // Pro ukládání výchozích hodnot každé sféry

// HTML elements presets

let presetContainer = document.querySelector('#presetContainer');
let presetInput, saveButton, resetButton, presetSelect, deleteButton, exportButton, importButton;

if (!presetContainer) {
    presetContainer = document.createElement('div');
    presetContainer.id = 'presetContainer';
    presetContainer.style.cssText = `
        position: fixed !important;
        top: 10px !important; 
        left: 10px !important;
        z-index: 1000 !important; 
        display: flex !important; 
        gap: 10px !important; 
    `;

    presetInput = document.createElement('input');
    presetInput.type = 'text';
    presetInput.placeholder = 'Preset name';
    presetInput.style.cssText = 'padding: 5px; border-radius: 3px;';

    saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.cssText = 'padding: 5px 10px; border-radius: 3px; background: #444; color: white; border: 1px solid #666;';

    resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.style.cssText = 'padding: 5px 10px; border-radius: 3px; background: #444; color: white; border: 1px solid #666;';

    presetSelect = document.createElement('select');
    presetSelect.style.cssText = 'padding: 5px; border-radius: 3px; background: #333; color: white; border: 1px solid #666;';

    deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.style.cssText = 'padding: 5px 10px; border-radius: 3px; background: #444; color: white; border: 1px solid #666;';

    exportButton = document.createElement('button');
    exportButton.textContent = 'Export Presets';
    exportButton.style.cssText = 'padding: 5px 10px; border-radius: 3px; background: #444; color: white; border: 1px solid #666;';

    importButton = document.createElement('button');
    importButton.textContent = 'Import Presets';
    importButton.style.cssText = 'padding: 5px 10px; border-radius: 3px; background: #444; color: white; border: 1px solid #666;';

    presetContainer.appendChild(presetInput);
    presetContainer.appendChild(saveButton);
    presetContainer.appendChild(resetButton);
    presetContainer.appendChild(deleteButton);
    presetContainer.appendChild(exportButton);
    presetContainer.appendChild(importButton);
    presetContainer.appendChild(presetSelect);

    document.body.appendChild(presetContainer);
}

// Save presets logic
saveButton.onclick = () => {
    const presetName = presetInput.value.trim();
    if (!presetName) return;
    presets[presetName] = spheres.map(sphere => JSON.parse(JSON.stringify(sphere.params)));
    localStorage.setItem('presets', JSON.stringify(presets));
    updatePresetOptions();
};

// Reset logic
resetButton.onclick = () => {
    spheres.forEach((sphere, index) => {
        const previousParticleCount = sphere.params.particleCount; // Uložíme původní počet částic
        
        Object.assign(sphere.params, defaultParams[index]);
        sphere.particleSystem.visible = sphere.params.enabled;

        if (sphere.params.particleCount !== previousParticleCount) {
            const {
                newPositions,
                newColors,
                newVelocities,
                newBasePositions,
                newLifetimes,
                newMaxLifetimes,
                newBeatEffects
            } = reinitializeParticlesForSphere(sphere, sphere.params, sphere.geometry);

            sphere.positions = newPositions;
            sphere.colors = newColors;
            sphere.velocities = newVelocities;
            sphere.basePositions = newBasePositions;
            sphere.lifetimes = newLifetimes;
            sphere.maxLifetimes = newMaxLifetimes;
            sphere.beatEffects = newBeatEffects;

            sphere.geometry.attributes.position.needsUpdate = true;
            sphere.geometry.attributes.color.needsUpdate = true;
        }

        const sphereFolder = mainGui.__folders[`Sphere ${index + 1}`];
        if (sphereFolder) {
            sphereFolder.__controllers.forEach(controller => controller.updateDisplay());
        }
    });

    console.log("Parameters reset to default values");
    mainGui.updateDisplay();
};

// Delete preset logic
deleteButton.onclick = () => {
    const presetName = presetSelect.value;
    if (!presetName) {
        console.warn('Žádný preset není vybraný.');
        return;
    }

    const sure = confirm(`Skutečně smazat preset "${presetName}"?`);
    if (!sure) return;

    delete presets[presetName];
    localStorage.setItem('presets', JSON.stringify(presets));
    updatePresetOptions();

    presetSelect.value = '';
    presetInput.value = '';

    console.log(`Preset "${presetName}" byl smazán.`);
};

// Export presets
exportButton.onclick = () => {
    const presetData = JSON.stringify(presets, null, 2);
    const blob = new Blob([presetData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'particula_presets.json';
    link.click();
    URL.revokeObjectURL(url);
};

// Import presets
importButton.onclick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.onchange = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const importedPresets = JSON.parse(e.target.result);
            Object.assign(presets, importedPresets);
            localStorage.setItem('presets', JSON.stringify(presets));
            updatePresetOptions();
            console.log('Presety byly úspěšně importovány.');
        };
        reader.readAsText(file);
    };
    fileInput.click();
};

// Upload presets logic
presetSelect.onchange = () => {
    const presetName = presetSelect.value;
    if (!presetName) return;
    const preset = presets[presetName];
    if (!preset) return;

    spheres.forEach((sphere, index) => {
        const previousParticleCount = sphere.params.particleCount; // Původní počet částic

        Object.assign(sphere.params, preset[index]);

        if (!('minFrequencyBeat' in sphere.params)) {
            sphere.params.minFrequencyBeat = sphere.params.minFrequency;
        }
        if (!('maxFrequencyBeat' in sphere.params)) {
            sphere.params.maxFrequencyBeat = sphere.params.maxFrequency;
        }

        if (sphere.params.minNoiseScale >= sphere.params.maxNoiseScale) {
            console.warn(`Preset fix: minNoiseScale (${sphere.params.minNoiseScale}) >= maxNoiseScale (${sphere.params.maxNoiseScale}).`);
            sphere.params.maxNoiseScale = sphere.params.minNoiseScale + 0.1;
        }

        if (sphere.params.particleCount !== previousParticleCount) {
            const {
                newPositions,
                newColors,
                newVelocities,
                newBasePositions,
                newLifetimes,
                newMaxLifetimes,
                newBeatEffects
            } = reinitializeParticlesForSphere(sphere, sphere.params, sphere.geometry);

            sphere.positions = newPositions;
            sphere.colors = newColors;
            sphere.velocities = newVelocities;
            sphere.basePositions = newBasePositions;
            sphere.lifetimes = newLifetimes;
            sphere.maxLifetimes = newMaxLifetimes;
            sphere.beatEffects = newBeatEffects;

            sphere.geometry.attributes.position.needsUpdate = true;
            sphere.geometry.attributes.color.needsUpdate = true;
        }

        sphere.particleSystem.visible = sphere.params.enabled;
    });

    mainGui.updateDisplay();
};

// Roll presets
function updatePresetOptions() {
    while (presetSelect.firstChild) {
        presetSelect.removeChild(presetSelect.firstChild);
    }
    
    const defaultOption = document.createElement('option');
    defaultOption.textContent = 'Select preset';
    defaultOption.value = '';
    presetSelect.appendChild(defaultOption);

    Object.keys(presets).forEach(name => {
        const option = document.createElement('option');
        option.textContent = name;
        option.value = name;
        presetSelect.appendChild(option);
    });
}

// Main GUI panel
const mainGui = new dat.GUI();

// FOG PARAMS
const fogParams = {
    enabled: true,
    color: '#000000',
    near: 2.7,
    far: 3.7,
};

// After fog update
function updateFog() {
    if (!fogParams.enabled) {
        scene.fog = null;
    } else {
        const color = new THREE.Color(fogParams.color);
        scene.fog = new THREE.Fog(color, fogParams.near, fogParams.far);

    }
    renderer.render(scene, camera); // Překreslení scény
}

// Fog init
if (fogParams.enabled) {
    updateFog();
}

// Adding to main GUI
mainGui.add(fogParams, 'enabled').name('Fog Enabled').onChange(updateFog);
mainGui.addColor(fogParams, 'color').name('Fog Color').onChange(updateFog);
mainGui.add(fogParams, 'near', 0.1, 5, 0.1).name('Fog Near').onChange(updateFog);
mainGui.add(fogParams, 'far', 0.1, 5, 0.1).name('Fog Far').onChange(updateFog);

// Main GUI particleCount
mainGui.add({
    globalParticleCount: 20000
}, 'globalParticleCount', 1000, 100000).step(1000).onChange(value => {
    spheres.forEach((sphere, index) => {
        sphere.params.particleCount = value;
        const {
            newPositions,
            newColors,
            newVelocities,
            newBasePositions,
            newLifetimes,
            newMaxLifetimes,
            newBeatEffects
        } = reinitializeParticlesForSphere(
            sphere, sphere.params, sphere.geometry
        );

        sphere.positions = newPositions;
        sphere.colors = newColors;
        sphere.velocities = newVelocities;
        sphere.basePositions = newBasePositions;
        sphere.lifetimes = newLifetimes;
        sphere.maxLifetimes = newMaxLifetimes;
        sphere.beatEffects = newBeatEffects;

        sphere.geometry.attributes.position.needsUpdate = true;
        sphere.geometry.attributes.color.needsUpdate = true;

        const sphereFolder = mainGui.__folders[`Sphere ${index + 1}`];
        if (sphereFolder) {
            const particleCountController = sphereFolder.__controllers.find(controller => controller.property === 'particleCount');
            if (particleCountController) {
                particleCountController.updateDisplay();
            }
        }
    });
});

const spheres = [];

function createSphereVisualization(index) {
    
    // Spheres default frequencies
    const defaultFrequencies = [
        { minFrequency: 20, maxFrequency: 80 },  // Sub-bass
        { minFrequency: 120, maxFrequency: 250 }, // Bass
        { minFrequency: 250, maxFrequency: 800 }, // Mid
        { minFrequency: 1000, maxFrequency: 4000 }, // High mid
        { minFrequency: 5000, maxFrequency: 10000 } // High
    ];

    const sphereParams = {
        enabled: index === 0,
        sphereRadius: 1.0,
        innerSphereRadius: 0.25,
        rotationSpeed: 0.001,
        rotationSpeedMin: 0,
        rotationSpeedMax: 0.065,
        rotationSmoothness: 0.3,
        particleCount: 20000,
        particleSize: 0.003,
        particleLifetime: 3.0,
        minFrequency: defaultFrequencies[index]?.minFrequency || 0,
        maxFrequency: defaultFrequencies[index]?.maxFrequency || 22050,
        minFrequencyBeat: defaultFrequencies[index]?.minFrequency || 0,
        maxFrequencyBeat: defaultFrequencies[index]?.maxFrequency || 22050,
        noiseScale: 4.0,
        dynamicNoiseScale: true,
        minNoiseScale: 0.5,       
        maxNoiseScale: 5.0,       
        noiseStep: 0.2,           
        noiseSpeed: 0.1,
        turbulenceStrength: 0.005,
        colorStart: '#66b3ff',
        colorEnd: '#3366ff',
        volumeChangeThreshold: 0.1,
        peakSensitivity: 1.1,
        beatThreshold: 200,
        baseWaveStrength: 20.0,
        beatStrength: 0.01,
        gainMultiplier: 1
    };

    const sphereGeometry = new THREE.BufferGeometry();
    const spherePositions = new Float32Array(sphereParams.particleCount * 3);
    const sphereColors = new Float32Array(sphereParams.particleCount * 3);
    const velocities = new Float32Array(sphereParams.particleCount * 3);
    const basePositions = new Float32Array(sphereParams.particleCount * 3);
    const lifetimes = new Float32Array(sphereParams.particleCount);
    const maxLifetimes = new Float32Array(sphereParams.particleCount);
    const beatEffects = new Float32Array(sphereParams.particleCount);

    // Init particles
    for (let i = 0; i < sphereParams.particleCount; i++) {
        const i3 = i * 3;
        const radius = THREE.MathUtils.lerp(0, sphereParams.sphereRadius, sphereParams.innerSphereRadius);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.cbrt(Math.random()) * radius;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        spherePositions[i3] = x;
        spherePositions[i3 + 1] = y;
        spherePositions[i3 + 2] = z;

        basePositions[i3] = x;
        basePositions[i3 + 1] = y;
        basePositions[i3 + 2] = z;

        velocities[i3] = 0;
        velocities[i3 + 1] = 0;
        velocities[i3 + 2] = 0;

        const lt = Math.random() * sphereParams.particleLifetime;
        lifetimes[i] = lt;
        maxLifetimes[i] = lt;

        beatEffects[i] = 0;
    }

    sphereGeometry.setAttribute('position', new THREE.BufferAttribute(spherePositions, 3));
    sphereGeometry.setAttribute('color', new THREE.BufferAttribute(sphereColors, 3));

    const sphereMaterial = new THREE.PointsMaterial({
        size: sphereParams.particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        fog: true
    });

    const sphereParticleSystem = new THREE.Points(sphereGeometry, sphereMaterial);
    scene.add(sphereParticleSystem);

    // Sphere visibility `enabled`
    sphereParticleSystem.visible = sphereParams.enabled;

    const sphere = {
        index: index,
        params: sphereParams,
        geometry: sphereGeometry,
        colors: sphereColors,
        material: sphereMaterial,
        particleSystem: sphereParticleSystem,
        positions: spherePositions,
        velocities: velocities,
        basePositions: basePositions,
        lifetimes: lifetimes,
        maxLifetimes: maxLifetimes,
        beatEffects: beatEffects,
        lastNoiseScale: sphereParams.noiseScale,
        lastValidVolume: 0,
        lastRotationSpeed: 0
    };

    sphere.peakDetection = {
        energyHistory: [],
        historyLength: 30,
        lastPeakTime: 0,
        minTimeBetweenPeaks: 200
    };

    // Colors update
    updateColorsForSphere(sphereParams, sphereGeometry, sphereColors);

    // GUI folder
    const sphereFolder = mainGui.addFolder('Sphere ' + (index + 1));

    sphereFolder.add(sphere.params, 'particleCount', 1000, 100000).step(1000)
        .onChange(() => {
            const {
                newPositions,
                newColors,
                newVelocities,
                newBasePositions,
                newLifetimes,
                newMaxLifetimes,
                newBeatEffects
            } = reinitializeParticlesForSphere(
                sphere, sphere.params, sphere.geometry
            );

            sphere.positions = newPositions;
            sphere.colors = newColors;
            sphere.velocities = newVelocities;
            sphere.basePositions = newBasePositions;
            sphere.lifetimes = newLifetimes;
            sphere.maxLifetimes = newMaxLifetimes;
            sphere.beatEffects = newBeatEffects;

            sphere.geometry.attributes.position.needsUpdate = true;
            sphere.geometry.attributes.color.needsUpdate = true;
        });
    
    sphereFolder.add(sphere.params, 'particleSize', 0.001, 0.01).step(0.001)
        .onChange(value => {
            sphere.material.size = value;
        });

    if (index === 0) { 
    sphereFolder.add({ copyToOthers: () => {
        for (let i = 1; i < spheres.length; i++) {
            Object.assign(spheres[i].params, JSON.parse(JSON.stringify(sphere.params)));
            
            const {
                newPositions,
                newColors,
                newVelocities,
                newBasePositions,
                newLifetimes,
                newMaxLifetimes,
                newBeatEffects
            } = reinitializeParticlesForSphere(
                spheres[i], spheres[i].params, spheres[i].geometry
            );

            spheres[i].positions = newPositions;
            spheres[i].colors = newColors;
            spheres[i].velocities = newVelocities;
            spheres[i].basePositions = newBasePositions;
            spheres[i].lifetimes = newLifetimes;
            spheres[i].maxLifetimes = newMaxLifetimes;
            spheres[i].beatEffects = newBeatEffects;

            spheres[i].geometry.attributes.position.needsUpdate = true;
            spheres[i].geometry.attributes.color.needsUpdate = true;


            spheres[i].particleSystem.visible = spheres[i].params.enabled;

            const targetFolder = mainGui.__folders[`Sphere ${i + 1}`];
            if (targetFolder) {
                targetFolder.__controllers.forEach(controller => controller.updateDisplay());
            }
        }
        mainGui.updateDisplay();
        console.log('Parameters copied from Sphere 1 to Spheres 2-5.');
    }}, 'copyToOthers').name('Copy to Spheres 2-5');
}
    sphereFolder.add(sphere.params, 'particleLifetime', 1, 20).step(1);

    sphereFolder.add(sphere.params, 'sphereRadius', 0.05, 3.0).step(0.05);
    sphereFolder.add(sphere.params, 'innerSphereRadius', 0, 1).step(0.01)
        .onChange(() => {
            const {
                newPositions,
                newColors,
                newVelocities,
                newBasePositions,
                newLifetimes,
                newMaxLifetimes,
                newBeatEffects
            } = reinitializeParticlesForSphere(sphere, sphere.params, sphere.geometry);

            sphere.positions = newPositions;
            sphere.colors = newColors;
            sphere.velocities = newVelocities;
            sphere.basePositions = newBasePositions;
            sphere.lifetimes = newLifetimes;
            sphere.maxLifetimes = newMaxLifetimes;
            sphere.beatEffects = newBeatEffects;
            
            sphere.geometry.attributes.position.needsUpdate = true;
            sphere.geometry.attributes.color.needsUpdate = true;
        });

    sphereFolder.add(sphere.params, 'rotationSpeedMin', 0, 0.02).step(0.001);
    sphereFolder.add(sphere.params, 'rotationSpeedMax', 0, 0.1).step(0.001);
    sphereFolder.add(sphere.params, 'rotationSmoothness', 0.01, 1).step(0.01);
    sphereFolder.add(sphere.params, 'volumeChangeThreshold', 0.01, 0.2).step(0.01);
    
    sphereFolder.add(sphereParams, 'minFrequency', 0, 22050).step(1).name('Min Frequency (Hz)')
        .onChange(value => sphereParams.minFrequency = value);
    sphereFolder.add(sphereParams, 'maxFrequency', 0, 22050).step(1).name('Max Frequency (Hz)')
        .onChange(value => sphereParams.maxFrequency = value);

    // GUI defaults
    const minFreqController = sphereFolder.__controllers.find(c => c.property === 'minFrequency');
    const maxFreqController = sphereFolder.__controllers.find(c => c.property === 'maxFrequency');
    if (minFreqController) minFreqController.setValue(sphereParams.minFrequency);
    if (maxFreqController) maxFreqController.setValue(sphereParams.maxFrequency);

    sphereFolder.add(sphere.params, 'noiseScale', 0.1, 10.0).step(0.1);
    sphereFolder.add(sphere.params, 'minNoiseScale', 0.0, 10.0).step(0.1).name('Min NoiseScale')
        .onChange(() => {
            if (sphere.params.minNoiseScale > sphere.params.maxNoiseScale) {
                sphere.params.minNoiseScale = sphere.params.maxNoiseScale;
            }
            updateNoiseStep(sphere.params);
        });
    sphereFolder.add(sphere.params, 'maxNoiseScale', 0.0, 10.0).step(0.1).name('Max NoiseScale')
        .onChange(() => {
            if (sphere.params.maxNoiseScale < sphere.params.minNoiseScale) {
                sphere.params.maxNoiseScale = sphere.params.minNoiseScale;
            }
            updateNoiseStep(sphere.params);
        });
    sphereFolder.add(sphere.params, 'noiseStep', 0.1, 5.0).step(0.1).name('Noise Step')
        .onChange(() => {
            updateNoiseStep(sphere.params);
        });
    function updateNoiseStep(params) {
        const range = params.maxNoiseScale - params.minNoiseScale;
        if (params.noiseStep > range) {
            params.noiseStep = range / 2;
        }
    }
    sphereFolder.add(sphere.params, 'noiseSpeed', 0, 1.0).step(0.01);

    sphereFolder.add(sphere.params, 'peakSensitivity', 1.01, 2).step(0.01);
    sphereFolder.add(sphere.peakDetection, 'historyLength', 10, 1200).step(1).name('History Length');
    sphereFolder.add(sphere.peakDetection, 'minTimeBetweenPeaks', 50, 5000).step(10).name('Min Time Between Peaks');

    sphereFolder.add(sphere.params, 'turbulenceStrength', 0, 0.03).step(0.0001);
    sphereFolder.addColor(sphere.params, 'colorStart')
        .onChange(() => updateColorsForSphere(sphere.params, sphere.geometry, sphere.colors));
    sphereFolder.addColor(sphere.params, 'colorEnd')
        .onChange(() => updateColorsForSphere(sphere.params, sphere.geometry, sphere.colors));

    sphereFolder.add(sphereParams, 'minFrequencyBeat', 0, 22050).step(1).name('Min Freq Beat (Hz)')
        .onChange(value => sphereParams.minFrequencyBeat = value);
    sphereFolder.add(sphereParams, 'maxFrequencyBeat', 0, 22050).step(1).name('Max Freq Beat (Hz)')
        .onChange(value => sphereParams.maxFrequencyBeat = value);

    sphereFolder.add(sphere.params, 'beatThreshold', 50, 255).step(1);
    sphereFolder.add(sphere.params, 'beatStrength', 0, 0.05).step(0.001);
    sphereFolder.add(sphere.params, 'gainMultiplier', 1.0, 3.0).step(0.1);
    sphereFolder.add(sphere.params, 'dynamicNoiseScale');
    sphereFolder.add(sphere.params, 'enabled').onChange(value => {
        sphere.particleSystem.visible = value;
    });

    sphereFolder.close();

    return sphere;
}

for (let i = 0; i < 5; i++) {
    const sphereVis = createSphereVisualization(i);
    spheres.push(sphereVis);
}

// Saving defaults spheres
spheres.forEach(sphere => {
    defaultParams.push(JSON.parse(JSON.stringify(sphere.params)));
});

// Init presets
updatePresetOptions();

// Only sphere 1 allowed
spheres.forEach((sphere, index) => {
    if (index !== 0) {
        sphere.params.enabled = false;
        sphere.particleSystem.visible = false;
    }
});

function getSmoothVolume(params, lastValidVolume, volumeChangeThreshold) {
    if (!analyser) return { volume: 0, shouldUpdate: false };

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const normalizedVolume = average / 255;

    let shouldUpdate = true;
    if (lastValidVolume === 0) {
        lastValidVolume = normalizedVolume;
    } else {
        const change = Math.abs(normalizedVolume - lastValidVolume);
        if (change <= volumeChangeThreshold) {
            lastValidVolume = normalizedVolume;
        } else {
            shouldUpdate = false;
        }
    }

    return { volume: lastValidVolume, shouldUpdate };
}

let lastTime = 0;
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    const deltaTime = lastTime ? (currentTime - lastTime) / 1000 : 0;
    lastTime = currentTime;

    // Beat wave update
    beatManager.update(deltaTime);

    // Sphere update
    spheres.forEach(sphere => {
        if (!sphere.params.enabled) return;

        const audioData = getAudioData(sphere);

        if (audioData.peakDetected) {
            if (sphere.params.dynamicNoiseScale) {
                sphere.params.noiseScale = generateNewNoiseScale(
                    sphere.params,
                    sphere.lastNoiseScale
                );
                sphere.lastNoiseScale = sphere.params.noiseScale;
            }
        }

        const { params, geometry, positions, velocities, basePositions, lifetimes, maxLifetimes, beatEffects } = sphere;

        // Beat detection sphere
        const beatDetected = audioData.rangeEnergyBeat > params.beatThreshold;

        // Beat wave sphere
        if (beatDetected && !beatManager.isWaveActive && params.beatStrength > 0) {
            beatManager.triggerWave(audioData.rangeEnergyBeat);
        }

        // Update particles
        const pc = params.particleCount;
        for (let i = 0; i < pc; i++) {
            const i3 = i * 3;

            let x = positions[i3];
            let y = positions[i3 + 1];
            let z = positions[i3 + 2];

            let vx = velocities[i3];
            let vy = velocities[i3 + 1];
            let vz = velocities[i3 + 2];

            let lt = lifetimes[i];
            let be = beatEffects[i];

            // Update lifetime
            lt -= deltaTime;

            // Noise calc
            const ns = params.noiseScale;
            const speed = params.noiseSpeed;
            const timeFactor = currentTime * 0.001;
            const noiseX = noise.noise3D(x * ns + timeFactor * speed, y * ns, z * ns);
            const noiseY = noise.noise3D(x * ns, y * ns + timeFactor * speed, z * ns);
            const noiseZ = noise.noise3D(x * ns, y * ns, z * ns + timeFactor * speed);

            vx += noiseX * params.turbulenceStrength;
            vy += noiseY * params.turbulenceStrength;
            vz += noiseZ * params.turbulenceStrength;

            // Beat effect
            if (beatDetected) {
                be = 1.0;
            }
            be *= 0.95;
            if (be > 0.01) {
                // směr z centra
                const dist = Math.sqrt(x*x + y*y + z*z);
                if (dist > 0) {
                    const dx = x / dist;
                    const dy = y / dist;
                    const dz = z / dist;

                    const beatForce = be * params.beatStrength;
                    vx += dx * beatForce;
                    vy += dy * beatForce;
                    vz += dz * beatForce;
                }
            }

            // Update positions
            x += vx;
            y += vy;
            z += vz;

            // Slowing speed
            vx *= 0.98;
            vy *= 0.98;
            vz *= 0.98;

            // Radius control
            const dist = Math.sqrt(x*x + y*y + z*z);
            if (dist > params.sphereRadius) {
                const overflow = dist - params.sphereRadius;
                const pullback = overflow * 0.1;
                if (dist > 0) {
                    const dx = x / dist;
                    const dy = y / dist;
                    const dz = z / dist;
                    x -= dx * pullback;
                    y -= dy * pullback;
                    z -= dz * pullback;
                }
                vx *= 0.9;
                vy *= 0.9;
                vz *= 0.9;
            }

            // Reset of dead particles
            if (lt <= 0) {
                const radius = THREE.MathUtils.lerp(0, params.sphereRadius, params.innerSphereRadius);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const rr = Math.cbrt(Math.random()) * radius;

                x = rr * Math.sin(phi) * Math.cos(theta);
                y = rr * Math.sin(phi) * Math.sin(theta);
                z = rr * Math.cos(phi);

                vx = 0;
                vy = 0;
                vz = 0;

                const newLt = Math.random() * params.particleLifetime;
                lt = newLt;
                maxLifetimes[i] = newLt;
                be = 0;

                basePositions[i3] = x;
                basePositions[i3 + 1] = y;
                basePositions[i3 + 2] = z;
            }

            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            velocities[i3] = vx;
            velocities[i3 + 1] = vy;
            velocities[i3 + 2] = vz;

            lifetimes[i] = lt;
            beatEffects[i] = be;
        }

        geometry.attributes.position.needsUpdate = true;

        // Dyn rotation
        const { volume: smoothVolume, shouldUpdate } = getSmoothVolume(
            params, 
            sphere.lastValidVolume, 
            params.volumeChangeThreshold
        );

        if (shouldUpdate) {
            const targetRotationSpeed = THREE.MathUtils.lerp(
                params.rotationSpeedMin,
                params.rotationSpeedMax,
                smoothVolume
            );
            sphere.lastRotationSpeed = params.rotationSpeed + 
                (targetRotationSpeed - params.rotationSpeed) * 
                params.rotationSmoothness;
        }

        sphere.particleSystem.rotation.y += sphere.lastRotationSpeed;

        // Saving volume
        if (shouldUpdate) sphere.lastValidVolume = smoothVolume;
    });

    renderer.render(scene, camera);
    updateTimeline();
}

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

let controlsVisible = true; // Stav viditelnosti

// Switching control elements
function toggleControlsVisibility() {
    controlsVisible = !controlsVisible;

    const allControls = document.querySelectorAll(
        '.controls-container, .dg.main, #audioControls, #presetContainer, #songSelect, #playPause, input[type="range"], button, select, input[type="text"]'
    );

    allControls.forEach(control => {
        control.style.display = controlsVisible ? 'block' : 'none';
    });
}

// Event listener on click
document.addEventListener('click', (event) => {
    const clickedElement = event.target;
    if (!clickedElement.closest('.controls-container') && 
        !clickedElement.closest('.dg.main') &&
        !clickedElement.closest('#audioControls') &&
        !clickedElement.closest('#presetContainer') &&
        !clickedElement.closest('#songSelect') &&
        !clickedElement.closest('#playPause') &&
        !clickedElement.closest('input[type="range"]') &&
        !clickedElement.closest('button') &&
        !clickedElement.closest('select') &&
        !clickedElement.closest('input[type="text"]')) {
        toggleControlsVisibility();
    }
});

document.querySelectorAll('.controls-container, .dg.main, #audioControls, #presetContainer').forEach(control => {
    control.style.position = 'absolute';
});

console.log('Starting animation');
initAudio();
animate(0);
