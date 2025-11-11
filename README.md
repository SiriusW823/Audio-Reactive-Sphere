# Audio Reactive Sphere

A real-time audio visualization that reacts to your microphone input. Watch particles dance and respond to sound in stunning 3D shapes.

## Features

- **Microphone-based visualization**  
  Captures live audio from your microphone using the Web Audio API

- **Multiple shapes**  
  Choose from sphere, cube, torus, or ring shapes for particle distribution

- **Customizable particles**  
  Adjust particle count, size, colors, and audio reaction sensitivity

- **Built-in presets**  
  10 beautiful presets showcasing different shapes and styles

- **Save and share**  
  Create and save your own presets, export and import configurations

## Quick Start

1. Open `index.html` in a modern web browser
2. Click the Start Audio Visualization button
3. Allow microphone access when prompted
4. Make some noise and watch the visualization react
5. Adjust controls on the right to customize the effect

## Controls

### Shape
Choose between sphere, cube, torus, or ring particle distributions

### Sphere Size
Control the overall size of the visualization (0.2 to 2.0)

### Reaction Strength
Adjust how strongly the particles react to audio input

### Particle Count
Set the number of particles (5,000 to 50,000)
Higher counts look better but may reduce performance on slower devices

### Particle Size
Control individual particle size (0.001 to 0.01)

### Colors
- **Outer Color**: Color at the edge of the shape
- **Inner Color**: Color at the center
Particles blend between these colors based on their distance from center

## Presets

### Using Presets
- Select a preset from the dropdown to instantly apply it
- Try different presets to explore various visual styles

### Saving Presets
1. Adjust controls to your liking
2. Enter a name in the preset text field
3. Click Save to store your configuration

### Managing Presets
- **Delete**: Remove a saved preset
- **Export**: Download all presets as a JSON file
- **Import**: Load presets from a JSON file

### Built-in Presets
- **Classic Sphere**: Traditional spherical visualization with blue tones
- **Neon Cube**: Bright magenta cube with energetic reactions
- **Electric Torus**: Cyan donut shape with dynamic movement
- **Cosmic Ring**: Orange disc perfect for rhythmic music
- **Crystal Sphere**: White crystalline sphere with subtle effects
- **Fire Cube**: Red and orange cube with intense reactions
- **Plasma Torus**: Purple plasma ring with strong turbulence
- **Galaxy Ring**: Blue disc with gentle movements
- **Ocean Sphere**: Blue sphere with wave-like motion
- **Sunrise Ring**: Warm orange disc with smooth reactions

## Running Locally

### Requirements
Node.js (for local server)

### Steps
1. Clone the repository
2. Open terminal in the project folder
3. Run a local server:
   ```bash
   npx serve .
   ```
4. Open `http://localhost:3000` in your browser

On Windows, you can also use the included `run.bat` file.

## Performance Tips

- Start with 10,000-20,000 particles and adjust based on performance
- Lower particle count on mobile devices or older computers
- Close other browser tabs to free up resources
- Use headphones to get clearer audio input

## Technical Details

- Built with Three.js for WebGL rendering
- Uses Web Audio API for microphone capture and frequency analysis
- Particle system with custom noise-based turbulence
- Real-time audio feature extraction and beat detection
- BufferGeometry and typed arrays for optimal performance

## Browser Support

Works best in modern browsers with WebGL and Web Audio support:
- Chrome/Edge (recommended)
- Firefox
- Safari (may have limitations)

Requires microphone permissions to function.

## Privacy

All audio processing happens locally in your browser. No audio data is sent to any server.

## License

MIT License

## Credits

Original project: https://github.com/Humprt/particula

Simplified and enhanced version with shape customization.
