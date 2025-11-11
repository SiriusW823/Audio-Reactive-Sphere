# Changelog

## Version 2.0 - Chrome Compliance & Enhanced Customization

### 🔒 Chrome AudioContext Fix (Required)
- **Issue**: Chrome's autoplay policy prevented automatic microphone access
- **Fix**: Added user interaction requirement with start button overlay
- **Result**: Now works correctly on GitHub Pages and all Chrome-based browsers

### 🎨 New Features (Enhanced Customization)

#### Particle Size Control
- Adjust individual particle size from 0.001 to 0.01
- Allows fine-tuning visual appearance
- Smaller particles = more ethereal look
- Larger particles = more bold, visible effect

#### Inner/Outer Color Gradient
- **Outer Color**: Color at the edge of the sphere
- **Inner Color**: Color at the center of the sphere
- **Effect**: Smooth color transition from center to edge
- **Creative Potential**: Create stunning gradient effects

### 🔄 Backward Compatibility
- All existing presets automatically work with new features
- Old single-color presets use that color for both inner and outer
- Default particle size applied if not specified in preset

### 📚 Documentation
- Updated README with new quick start instructions
- Added usage tips for new controls
- Noted Chrome autoplay policy requirement

---

## Migration Guide for Preset Creators

If you're creating new presets, consider:

1. **Particle Size**: `0.003` is the default, try `0.001` for subtle effects or `0.007` for bold particles
2. **Color Gradients**: Complementary colors work great (e.g., blue outer, purple inner)
3. **Contrast**: High contrast between inner/outer creates dramatic effects

### Example Preset:
```json
{
  "sphereRadius": 1.0,
  "particleCount": 20000,
  "particleSize": 0.005,
  "color": "#66b3ff",
  "innerColor": "#ff6b9d",
  "reactionStrength": 0.008
}
```

---

## Technical Notes

### AudioContext Implementation
- Uses Chrome's requirement: AudioContext must be created/resumed in user gesture
- Implements proper state checking before resume
- Graceful error handling with retry capability

### Color Gradient Algorithm
- Uses `THREE.MathUtils.lerp()` for smooth interpolation
- Calculates normalized distance from center: `dist / sphereRadius`
- Applies to all three color channels (R, G, B) independently

### Performance
- No performance impact from new features
- Gradient calculation happens during initialization
- Particle size is a material property (efficient)

---

## Known Issues & Future Enhancements

### Current Limitations
- None identified

### Potential Future Features
- Multiple color stops (more than 2)
- Different particle shapes
- Animation presets
- Keyboard shortcuts

---

## Questions?

For issues or suggestions, please open an issue on GitHub or contribute a pull request!
