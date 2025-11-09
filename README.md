# Audio Reactive Sphere

A real-time audio visualization that reacts to your microphone input. Watch as particles dance and respond to sound, frequency, and rhythm in 3D space.

## 🎤 Live Demo

Try it online: [Audio Reactive Sphere on GitHub Pages](https://siriusw823.github.io/Audio-Reactive-Sphere/)

## ✨ Features

- **Microphone-based visualization** - Just allow microphone access and start making sound!
- **Real-time particle reactions** - Watch thousands of particles respond instantly to audio
- **Simple controls** - Easy-to-use interface with just the essentials:
  - Enable/disable spheres
  - Adjust sphere size
  - Control reaction strength
  - Change colors with a single click
  - Adjust particle count for performance
- **Multiple spheres** - Five independent particle spheres (only first enabled by default)
- **Preset system** - Save, load, export, and import your favorite configurations

## 🚀 Quick Start

1. Open the website (or run locally)
2. Allow microphone access when prompted
3. Start talking, singing, or playing music!
4. Adjust the controls in the panel on the right

That's it! No uploading files, no complicated setup.

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

- **Size**: Controls the radius of the sphere
- **Reaction Strength**: How much the particles move in response to audio (higher = more movement)
- **Particle Count**: More particles = more detail but lower performance
- **Color**: Single color for all particles - experiment with different colors!

## 🔧 Advanced Usage

Want more control? The advanced parameters are still there in the code, they're just hidden from the UI for simplicity. You can:
- Save presets with custom configurations
- Enable multiple spheres for different frequency ranges
- Export and import presets to share with others

## 📝 Technical Details

- Built with Three.js for 3D rendering
- Uses Web Audio API for microphone input and frequency analysis
- Particle system with noise-based turbulence
- Beat detection with reactive wave effects
- Runs entirely in the browser - no server needed!

## 🌐 GitHub Pages Deployment

This project automatically deploys to GitHub Pages when changes are pushed to the main branch.

To deploy your fork:
1. Go to your repository Settings
2. Navigate to Pages
3. Under "Build and deployment", select "GitHub Actions" as the source
4. Push to the main branch and the site will deploy automatically

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

Simplified version with microphone-only input and easier controls.
