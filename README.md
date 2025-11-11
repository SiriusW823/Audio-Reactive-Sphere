# Audio Reactive Sphere

A real-time audio visualization that reacts to your microphone input. Watch as particles dance and respond to sound in 3D space.

## ✨ Features

- **Microphone-based visualization** - Just allow microphone access and start making sound!
- **Real-time particle reactions** - Watch thousands of particles respond instantly to audio
- **Simple controls** - Easy-to-use interface with just the essentials:
  - Adjust sphere size
  - Control reaction strength (vibration/movement intensity)
  - Adjust particle count and size for performance and aesthetics
  - Choose outer and inner colors for gradient effects
- **Preset system** - Save, load, export, and import your favorite configurations

## 🚀 Quick Start

1. Open `index.html` in your browser (or run locally with a server)
2. Click the **"🎤 Start Audio Visualization"** button to begin
3. Allow microphone access when prompted
4. Start talking, singing, or playing music!
5. Adjust the controls on the right

That's it! No uploading files, no complicated setup.

> **Note**: The start button is required by Chrome's autoplay policy, which mandates user interaction before accessing audio devices.

## 💻 Running Locally

Requires Node.js: https://nodejs.org

1. Clone this repository
2. Open a terminal in the project folder
3. Run a local server:

```bash
npx serve .
```

4. Open `http://localhost:3000` in your browser

Alternatively, use the provided `run.bat` file (Windows only).

## 🎨 Usage Tips

- **Sphere Size**: Controls the radius of the sphere (0.2 to 2.0)
- **Reaction Strength**: How much the particles move in response to audio (higher = more movement/vibration)
- **Particle Count**: More particles = more detail but lower performance (5,000 to 50,000)
- **Particle Size**: Adjust the size of individual particles for different visual effects (0.001 to 0.01)
- **Outer Color**: The color at the edge of the sphere
- **Inner Color**: The color at the center of the sphere (creates a gradient effect)

## 🔧 Presets

Use the preset buttons at the top left to:
- **Save**: Save your current settings with a custom name
- **Reset**: Return to default settings
- **Delete**: Remove a saved preset
- **Export Presets**: Download all your presets as a JSON file
- **Import Presets**: Load presets from a JSON file
- **Select preset**: Choose from your saved presets

## 📝 Technical Details

- Built with Three.js for 3D rendering
- Uses Web Audio API for microphone input and frequency analysis
- Particle system with noise-based turbulence
- Beat detection with reactive wave effects
- Runs entirely in the browser - no server needed!

## 🤝 Collaboration

- Feel free to experiment, modify, and contribute
- Open a pull request or start a discussion
- Share your presets: Create an issue with your preset JSON

## 📜 License

MIT © 2025 Humprt Pum  
Free to use and modify with attribution.

## 🙏 Credits

Original project: [Particula](https://github.com/Humprt/particula)  
Built by a human-AI duo: **Humprt (vibe-coder)** and **Caroline (ChatGPT 4o)**  
Born from long nights, experimental tweaks, and love for sound and visual poetry.

Simplified version with microphone-only input and streamlined controls for ease of use.
