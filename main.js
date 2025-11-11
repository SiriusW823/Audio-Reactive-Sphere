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

// Microphone status indicator
const micStatus = document.createElement('div');
micStatus.style.cssText = 'position: fixed; top: 10px; right: 310px; z-index: 1000; background: rgba(0,0,0,0.7); padding: 10px 20px; border-radius: 5px; color: white; font-size: 14px;';
micStatus.innerHTML = '🎤 Microphone: <span id="mic-status-text">Not started</span>';
document.body.appendChild(micStatus);

let usingMic = true; // Always use microphone

// Start button overlay for user interaction requirement
const startOverlay = document.createElement('div');
startOverlay.id = 'start-overlay';
startOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
`;

const startButton = document.createElement('button');
startButton.textContent = '🎤 Start Audio Visualization';
startButton.style.cssText = `
    padding: 20px 40px;
    font-size: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
`;
startButton.onmouseover = () => {
    startButton.style.transform = 'scale(1.05)';
    startButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
};
startButton.onmouseout = () => {
    startButton.style.transform = 'scale(1)';
    startButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
};

const startInfo = document.createElement('p');
startInfo.textContent = 'Click to allow microphone access and start visualization';
startInfo.style.cssText = `
    color: rgba(255, 255, 255, 0.7);
    margin-top: 20px;
    font-size: 16px;
`;

startOverlay.appendChild(startButton);
startOverlay.appendChild(startInfo);
document.body.appendChild(startOverlay);

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

// Initialize microphone with user interaction
async function initMicrophone() {
    const statusText = document.getElementById('mic-status-text');
    
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
        }
        
        // Resume AudioContext (requires user gesture in Chrome)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        statusText.textContent = 'Requesting access...';
        
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false
            }
        });

        micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(analyser);
        // Don't connect to destination to avoid feedback
        // analyser.disconnect(audioContext.destination);

        statusText.textContent = 'Active ✓';
        statusText.style.color = '#4ade80';
        console.log('Microphone is active');
        
        // Remove the start overlay after successful initialization
        const overlay = document.getElementById('start-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.5s';
            setTimeout(() => overlay.remove(), 500);
        }
        
    } catch (error) {
        console.error("Microphone access failed:", error.name, error.message);
        statusText.textContent = 'Access Denied ✗';
        statusText.style.color = '#ef4444';
        
        // Show error on overlay
        const overlay = document.getElementById('start-overlay');
        if (overlay) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = 'Microphone access denied. Please allow access and try again.';
            errorMsg.style.cssText = 'color: #ef4444; margin-top: 20px; font-size: 16px;';
            overlay.appendChild(errorMsg);
            
            // Allow retry
            startButton.textContent = '🔄 Retry';
        }
    }
}

// Add click event to start button
startButton.addEventListener('click', initMicrophone);

// Remove audio file functionality - microphone only
// Audio initialization is now handled by initMicrophone()

function getAudioData(sphere) {
    if (!analyser) return { 
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


// Remove unused audio playback functions

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
    // Use gradient from innerColor to color (outer)
    const outerColor = new THREE.Color(sphereParams.color || sphereParams.colorStart);
    const innerColor = new THREE.Color(sphereParams.innerColor || sphereParams.colorEnd || sphereParams.colorStart);

    const positions = sphereGeometry.attributes.position.array;
    
    for (let i = 0; i < sphereParams.particleCount; i++) {
        const i3 = i * 3;
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        const dist = Math.sqrt(x*x + y*y + z*z);
        const normalizedDist = Math.min(dist / sphereParams.sphereRadius, 1.0);
        
        // Interpolate between inner and outer color based on distance
        sphereColors[i3] = THREE.MathUtils.lerp(innerColor.r, outerColor.r, normalizedDist);
        sphereColors[i3 + 1] = THREE.MathUtils.lerp(innerColor.g, outerColor.g, normalizedDist);
        sphereColors[i3 + 2] = THREE.MathUtils.lerp(innerColor.b, outerColor.b, normalizedDist);
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

// Save presets logic - Single sphere
saveButton.onclick = () => {
    const presetName = presetInput.value.trim();
    if (!presetName) return;
    // Save only the first sphere's parameters
    presets[presetName] = JSON.parse(JSON.stringify(spheres[0].params));
    localStorage.setItem('presets', JSON.stringify(presets));
    updatePresetOptions();
};

// Reset logic - Single sphere
resetButton.onclick = () => {
    const sphere = spheres[0];
    const previousParticleCount = sphere.params.particleCount;
    
    Object.assign(sphere.params, defaultParams[0]);
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

// Upload presets logic - Single sphere
presetSelect.onchange = () => {
    const presetName = presetSelect.value;
    if (!presetName) return;
    const preset = presets[presetName];
    if (!preset) return;

    const sphere = spheres[0];
    const previousParticleCount = sphere.params.particleCount;

    // Handle both old multi-sphere presets and new single-sphere presets
    const presetData = Array.isArray(preset) ? preset[0] : preset;
    Object.assign(sphere.params, presetData);

    // Backward compatibility: if old preset doesn't have 'color', use colorStart
    if (!('color' in sphere.params) && 'colorStart' in sphere.params) {
        sphere.params.color = sphere.params.colorStart;
    }
    // Backward compatibility: if old preset doesn't have 'innerColor', use colorEnd or color
    if (!('innerColor' in sphere.params)) {
        sphere.params.innerColor = sphere.params.colorEnd || sphere.params.color;
    }
    // Backward compatibility: if old preset doesn't have 'reactionStrength', use turbulenceStrength
    if (!('reactionStrength' in sphere.params) && 'turbulenceStrength' in sphere.params) {
        sphere.params.reactionStrength = sphere.params.turbulenceStrength;
    }

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
    
    // Update material size
    sphere.material.size = sphere.params.particleSize;
    
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

// Main GUI panel - Simplified for single sphere
const mainGui = new dat.GUI();

// Title in GUI
const titleController = mainGui.add({ title: 'Audio Reactive Sphere' }, 'title').name('🎵 Controls');
titleController.domElement.style.pointerEvents = 'none';
titleController.domElement.style.opacity = '0.7';

const spheres = [];

function createSphereVisualization(index) {
    
    // Only create first sphere
    if (index !== 0) return null;
    
    // Single sphere default frequencies
    const defaultFrequencies = [
        { minFrequency: 20, maxFrequency: 22050 }  // Full spectrum
    ];

    const sphereParams = {
        enabled: true,
        sphereRadius: 1.0,
        particleCount: 20000,
        particleSize: 0.003,
        reactionStrength: 0.005,  // Simplified parameter for turbulence
        color: '#66b3ff',  // Outer color
        innerColor: '#3366ff',  // Inner color (new)
        // Hidden advanced parameters
        innerSphereRadius: 0.25,
        rotationSpeed: 0.001,
        rotationSpeedMin: 0,
        rotationSpeedMax: 0.065,
        rotationSmoothness: 0.3,
        particleLifetime: 3.0,
        minFrequency: defaultFrequencies[0].minFrequency,
        maxFrequency: defaultFrequencies[0].maxFrequency,
        minFrequencyBeat: defaultFrequencies[0].minFrequency,
        maxFrequencyBeat: defaultFrequencies[0].maxFrequency,
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

    // Colors update - use gradient from innerColor to color (outer)
    const updateSphereColor = () => {
        const outerColor = new THREE.Color(sphereParams.color);
        const innerColor = new THREE.Color(sphereParams.innerColor);
        
        for (let i = 0; i < sphereParams.particleCount; i++) {
            const i3 = i * 3;
            // Calculate distance from center to determine color
            const x = spherePositions[i3];
            const y = spherePositions[i3 + 1];
            const z = spherePositions[i3 + 2];
            const dist = Math.sqrt(x*x + y*y + z*z);
            const normalizedDist = Math.min(dist / sphereParams.sphereRadius, 1.0);
            
            // Interpolate between inner and outer color based on distance
            sphereColors[i3] = THREE.MathUtils.lerp(innerColor.r, outerColor.r, normalizedDist);
            sphereColors[i3 + 1] = THREE.MathUtils.lerp(innerColor.g, outerColor.g, normalizedDist);
            sphereColors[i3 + 2] = THREE.MathUtils.lerp(innerColor.b, outerColor.b, normalizedDist);
        }
        // Also update the hidden gradient colors for backward compatibility
        sphereParams.colorStart = sphereParams.color;
        sphereParams.colorEnd = sphereParams.innerColor;
        sphereGeometry.attributes.color.needsUpdate = true;
    };
    updateSphereColor();

    // GUI - Essential controls only (no folder, just add to main GUI)
    mainGui.add(sphere.params, 'sphereRadius', 0.2, 2.0).step(0.1).name('Sphere Size')
        .onChange(() => {
            // Reinitialize particles when size changes significantly
        });

    mainGui.add(sphere.params, 'reactionStrength', 0, 0.02).step(0.001).name('Reaction Strength')
        .onChange(value => {
            // Update the actual turbulence strength
            sphere.params.turbulenceStrength = value;
        });

    mainGui.add(sphere.params, 'particleCount', 5000, 50000).step(5000).name('Particle Count')
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
    
    mainGui.add(sphere.params, 'particleSize', 0.001, 0.01).step(0.001).name('Particle Size')
        .onChange(value => {
            sphere.material.size = value;
        });
    
    mainGui.addColor(sphere.params, 'color').name('Outer Color')
        .onChange(() => {
            updateSphereColor();
        });
    
    mainGui.addColor(sphere.params, 'innerColor').name('Inner Color')
        .onChange(() => {
            updateSphereColor();
        });

    return sphere;
}

// Create only one sphere
const sphereVis = createSphereVisualization(0);
if (sphereVis) {
    spheres.push(sphereVis);
}

// Saving defaults spheres
spheres.forEach(sphere => {
    defaultParams.push(JSON.parse(JSON.stringify(sphere.params)));
});

// Init presets
updatePresetOptions();

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
// Don't initialize microphone automatically - wait for user interaction
animate(0);
