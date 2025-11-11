# Audio Reactive Sphere

A real-time audio visualization that reacts to your microphone input. Particles dance and respond to sound in 3D space for live, browser-based visual feedback.

## Features

- Microphone-based visualization  
  Captures live audio from the user's microphone using the Web Audio API and performs frequency/time-domain analysis in real time.

- Real-time particle reactions  
  A high-performance particle system maps audio features (overall amplitude, per-band energy, and detected beats) to particle position, velocity, color, and other attributes so the visuals respond instantly to sound.

- Configurable controls  
  Fine-grained UI controls for appearance and performance:
  - Sphere radius
  - Reaction strength (how strongly audio affects particles)
  - Particle count and individual particle size
  - Inner/outer color selection for a radial gradient
  - Sensitivity and smoothing options for audio-driven motion

- Preset system  
  Save, load, import, export, and delete presets (stored in browser localStorage by default) so you can recall favorite visual configurations quickly or share them with others.

- Performance-oriented implementation  
  Uses BufferGeometry, typed arrays, and GPU-friendly updates to minimize CPU work and allocation per frame. Shader attributes and instanced or buffer-based rendering keep frame rates higher even with many particles.

## Quick Start

1. Open `index.html` in your browser (or run locally with a static server).
2. Click the Start Audio Visualization button to begin.
3. Allow microphone access when prompted.
4. Produce sound (speak, sing, play music) and observe the visualization.
5. Adjust the controls in the UI to change appearance and responsiveness.

Note: The Start button is required by some browsers' autoplay and privacy policies, which require user interaction before capturing audio.

## Running Locally

Requires Node.js: https://nodejs.org

1. Clone this repository:
   git clone https://github.com/SiriusW823/Audio-Reactive-Sphere.git
2. Open a terminal in the project folder.
3. Run a local static server (example):
```bash
npx serve .
```
4. Open `http://localhost:3000` in your browser.

Alternatively, on Windows you can use the included `run.bat` if present to start a simple local server.

## Controls and Usage Details

- Sphere Size (0.2 to 2.0)  
  Controls the base radius where particles are positioned. Larger values spread particles farther apart and change perceived density.

- Reaction Strength  
  Global multiplier applied to audio-driven displacement and velocity. Increase for more dramatic movement, decrease for subtler motion.

- Particle Count (recommended 1,000 — 50,000)  
  Number of rendered particles. Higher counts increase detail and smoothness at the cost of GPU/CPU resources. Use smaller values on mobile or integrated GPUs.

- Particle Size (0.001 to 0.01)  
  Visual size for each particle. Larger sizes appear as soft glows, smaller sizes appear as fine points.

- Outer and Inner Color  
  Two-color gradient applied across the sphere radius. Colors are interpolated per-particle to create depth and variation.

- Sensitivity and Smoothing  
  Parameters that scale and smooth raw audio values to avoid jitter and allow responsive yet stable visuals. Smoothing reduces sudden jumps, sensitivity scales raw input amplitude.

UI tips:
- Start with moderate particle count (5k–20k) and medium reaction strength.
- Use headphones or a near-field speaker for clearer microphone input when testing.
- Lower particle count and size on low-power devices for stable performance.

## Presets

Preset actions:
- Save: store current UI settings under a custom name (saved to localStorage).
- Load: apply a stored preset instantly.
- Reset: revert all controls to default values.
- Delete: remove a saved preset.
- Export: download all presets as a JSON file for sharing or backup.
- Import: load presets from a previously exported JSON file.

Exported JSON is an array of plain objects describing the control values. Import validation is performed to avoid malformed data.

## Technical Details

- Rendering
  - Built with Three.js for WebGL rendering.
  - Particle attributes (positions, colors, offsets) are stored in BufferGeometry with typed array attributes to minimize per-frame allocations.
  - Custom shaders or material attributes are used to apply audio-reactive effects on the GPU where possible.

- Audio pipeline
  - Uses navigator.mediaDevices.getUserMedia to request microphone input.
  - Creates an AudioContext and an AnalyserNode to perform FFT-based frequency analysis.
  - Typical analyzer settings: FFT size selectable (e.g., 1024–16384) for different frequency resolution. SmoothingTimeConstant and min/max decibel thresholds are used to stabilize readings.
  - Frequency bins are grouped into bands (bass, mid, treble) and mapped to particle responses. Overall RMS or summed energy is used for amplitude/beat cues.

- Particle system
  - Particles are initially positioned on or near a sphere surface with small random offsets for natural variation.
  - Each frame, a combination of noise-driven turbulence and audio-scaled displacement updates particle positions/velocities.
  - Attributes are updated on the CPU into typed arrays and sent to the GPU via BufferGeometry.needsUpdate (only for attributes that changed).

- Beat detection
  - Implements energy-based detection: compute short-term energy versus a running average and trigger pulse/wave effects when energy crosses a threshold.
  - Thresholds and averaging windows are adjustable in the code/UI for different genres and volumes.

- Performance
  - Reduce particle count or particle size to improve frame rate.
  - Avoid frequent allocations; reuse typed arrays for audio data and attributes.
  - Use requestAnimationFrame for rendering. Consider using WebGL2 or enabling antialiasing carefully (it increases cost).
  - When available, hardware-accelerated GPUs and modern browsers give the best experience.

Recommended device settings:
- Desktop (discrete GPU): 20,000 — 50,000 particles
- Laptop (integrated GPU): 5,000 — 20,000 particles
- Mobile: 1,000 — 5,000 particles

## Privacy and Security

- Microphone access is requested only when you start the visualization. No audio is uploaded to any server by this project — all processing happens locally in the browser.
- You can revoke permission from your browser at any time. If you close the page, the audio context is closed and input stops.
- If you wish to inspect or modify how audio is handled, see the audio initialization and analyser node code in the source files.

## Troubleshooting

- No sound detected:
  - Ensure your microphone is connected and allowed in the browser when prompted.
  - Check browser site permissions and system privacy settings.
  - Try increasing sensitivity in the UI or move closer to the sound source.

- Low performance / low FPS:
  - Reduce particle count and particle size.
  - Disable high-cost effects where applicable.
  - Use a modern browser (Chrome, Edge, Firefox) and close other GPU-heavy tabs.

- Visuals too jittery:
  - Increase smoothing or reduce sensitivity in the UI.
  - Lower FFT resolution or adjust analyzer smoothing to produce steadier data.

## Contributing

Contributions are welcome. To contribute:
- Open an issue to discuss a feature, bug, or idea before large changes.
- Fork the repository and create a branch for your work.
- Keep changes focused and document the behavior change.
- Include screenshots or short recordings for visual improvements when possible.
- Run performance checks on multiple devices if applicable.

Suggested contribution ideas:
- Add additional shader effects (glow, blur, post-processing).
- Extend input sources (audio file playback, Web Audio sinks).
- Implement alternative particle distribution shapes (torus, cube, custom meshes).

## License

MIT © 2025 Humprt Pum

Free to use and modify with attribution.

## Credits

Original project: https://github.com/Humprt/particula

Built by Humprt (vibe-coder) with assistance from an AI-based collaborator.

This simplified version focuses on microphone-only input and streamlined controls for ease of use.
