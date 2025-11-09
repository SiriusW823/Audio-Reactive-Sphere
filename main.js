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
micStatus.innerHTML = '🎤 Microphone: <span id="mic-status-text">Initializing...</span>';
document.body.appendChild(micStatus);

let usingMic = true; // Always use microphone

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

// Initialize microphone automatically
async function initMicrophone() {
    const statusText = document.getElementById('mic-status-text');
    
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
        }
        await audioContext.resume();

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
        
    } catch (error) {
        console.error("Microphone access failed:", error.name, error.message);
        statusText.textContent = 'Access Denied ✗';
        statusText.style.color = '#ef4444';
        alert('Microphone access is required for this application. Please allow microphone access and refresh the page.');
    }
}

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
    // Use single color if available, otherwise use colorStart
    const colorToUse = sphereParams.color || sphereParams.colorStart;
    const color = new THREE.Color(colorToUse);

    for (let i = 0; i < sphereParams.particleCount; i++) {
        sphereColors[i * 3] = color.r;
        sphereColors[i * 3 + 1] = color.g;
        sphereColors[i * 3 + 2] = color.b;
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

        // Backward compatibility: if old preset doesn't have 'color', use colorStart
        if (!('color' in sphere.params) && 'colorStart' in sphere.params) {
            sphere.params.color = sphere.params.colorStart;
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

// Main GUI panel - Simplified
const mainGui = new dat.GUI();

// Title in GUI
const titleController = mainGui.add({ title: 'Audio Reactive Sphere' }, 'title').name('🎵 Controls');
titleController.domElement.style.pointerEvents = 'none';
titleController.domElement.style.opacity = '0.7';

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
        particleCount: 20000,
        particleSize: 0.003,
        reactionStrength: 0.005,  // Simplified parameter for turbulence
        color: '#66b3ff',  // Single color instead of gradient
        // Hidden advanced parameters
        innerSphereRadius: 0.25,
        rotationSpeed: 0.001,
        rotationSpeedMin: 0,
        rotationSpeedMax: 0.065,
        rotationSmoothness: 0.3,
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

    // Colors update - use single color
    const updateSphereColor = () => {
        const color = new THREE.Color(sphereParams.color);
        for (let i = 0; i < sphereParams.particleCount; i++) {
            sphereColors[i * 3] = color.r;
            sphereColors[i * 3 + 1] = color.g;
            sphereColors[i * 3 + 2] = color.b;
        }
        // Also update the hidden gradient colors
        sphereParams.colorStart = sphereParams.color;
        sphereParams.colorEnd = sphereParams.color;
        sphereGeometry.attributes.color.needsUpdate = true;
    };
    updateSphereColor();

    // GUI folder - Simplified controls
    const sphereFolder = mainGui.addFolder('Sphere ' + (index + 1));

    // Essential controls only
    sphereFolder.add(sphere.params, 'enabled').name('Enable').onChange(value => {
        sphere.particleSystem.visible = value;
    });

    sphereFolder.add(sphere.params, 'sphereRadius', 0.2, 2.0).step(0.1).name('Size')
        .onChange(() => {
            // Reinitialize particles when size changes significantly
        });

    sphereFolder.add(sphere.params, 'reactionStrength', 0, 0.02).step(0.001).name('Reaction Strength')
        .onChange(value => {
            // Update the actual turbulence strength
            sphere.params.turbulenceStrength = value;
        });

    sphereFolder.add(sphere.params, 'particleCount', 5000, 50000).step(5000).name('Particle Count')
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
    
    sphereFolder.addColor(sphere.params, 'color').name('Color')
        .onChange(() => {
            const color = new THREE.Color(sphere.params.color);
            for (let i = 0; i < sphere.params.particleCount; i++) {
                sphere.colors[i * 3] = color.r;
                sphere.colors[i * 3 + 1] = color.g;
                sphere.colors[i * 3 + 2] = color.b;
            }
            sphere.params.colorStart = sphere.params.color;
            sphere.params.colorEnd = sphere.params.color;
            sphere.geometry.attributes.color.needsUpdate = true;
        });

    sphereFolder.open(); // Keep first sphere folder open
    if (index !== 0) {
        sphereFolder.close(); // Close other spheres
    }

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
initMicrophone(); // Initialize microphone automatically
animate(0);
