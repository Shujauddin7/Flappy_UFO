# Planet Component

A lightweight, reusable React component that displays spinning planets with realistic glow effects using CSS animations and Tailwind CSS.

## Features

- ✨ **Infinite spinning animation** - Smooth CSS-only rotation
- 🌍 **Planet-specific glow colors** - Realistic atmospheric glows (Earth=blue, Mars=red, Jupiter=orange, etc.)
- 🎨 **3D depth effects** - Inner highlights and inset shadows for realistic appearance  
- 💍 **Gas giant rings** - Atmospheric rings for Jupiter, Saturn, Uranus, and Neptune
- 📱 **Fully responsive** - Works on all screen sizes
- ⚡ **Lightweight** - Pure CSS animations, no JavaScript libraries
- 🎯 **Customizable size** - Any size from small icons to large displays

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✅ | Planet name (affects glow color and special effects) |
| `image` | `string` | ✅ | Path to image from `/public` folder (e.g., `"/Earth.jpg"`) |
| `size` | `number` | ✅ | Planet diameter in pixels |

## Supported Planet Names

Planet names with special glow colors:
- **Earth** - Blue glow (`#4A90E2`)
- **Mars** - Red-orange glow (`#FF6B35`) 
- **Jupiter** - Orange-yellow glow + ring (`#FFB347`)
- **Saturn** - Golden glow + ring (`#F4D03F`)
- **Venus** - Bright yellow glow (`#FFC300`)
- **Neptune** - Deep blue glow + ring (`#3498DB`)
- **Uranus** - Light blue glow + ring (`#85C1E9`)
- **Mercury** - Gray-white glow (`#D7DBDD`)
- **Custom names** - Default white glow

## Usage Examples

### Basic Usage
```jsx
import Planet from '@/components/Planet';

function SolarSystem() {
    return (
        <div className="flex space-x-8">
            <Planet name="Earth" image="/Earth.jpg" size={120} />
            <Planet name="Mars" image="/Mercury.jpg" size={100} />
            <Planet name="Jupiter" image="/Jupiter.jpg" size={140} />
        </div>
    );
}
```

### Different Sizes
```jsx
// Small planets for UI icons
<Planet name="Mercury" image="/Mercury.jpg" size={60} />

// Medium planets for cards  
<Planet name="Earth" image="/Earth.jpg" size={120} />

// Large planets for heroes
<Planet name="Jupiter" image="/Jupiter.jpg" size={200} />
```

### Custom Planets
```jsx
// Custom planet with default white glow
<Planet name="Kepler-442b" image="/custom-exoplanet.jpg" size={110} />
```

### Grid Layout
```jsx
<div className="grid grid-cols-3 gap-8">
    <Planet name="Earth" image="/Earth.jpg" size={100} />
    <Planet name="Mars" image="/Mercury.jpg" size={80} />
    <Planet name="Jupiter" image="/Jupiter.jpg" size={120} />
    <Planet name="Saturn" image="/Saturn.jpg" size={115} />
    <Planet name="Venus" image="/Venus.jpg" size={95} />
    <Planet name="Neptune" image="/Neptune.jpg" size={105} />
</div>
```

## Demo

Visit `/planet-demo` to see all planets in action with different sizes and effects.

## Technical Details

- **Animation**: Uses Tailwind's `animate-spin` with 20-second duration for realistic rotation
- **3D Effects**: Combines `box-shadow` inset shadows with radial gradients
- **Performance**: Pure CSS animations, no JavaScript runtime overhead
- **Responsive**: Uses pixel-based sizing for consistent cross-device appearance
- **Accessibility**: Semantic HTML structure

## Available Planet Images

Your `/public` folder contains:
- `Earth.jpg`
- `Jupiter.jpg` 
- `Mercury.jpg`
- `Neptune.jpg`
- `Saturn.jpg`
- `Uranus.jpg`
- `Venus.jpg`
- `OSIRIS.jpg` (custom)

## Integration Examples

### In Game UI
```jsx
// Score display with planet icon
<div className="flex items-center space-x-2">
    <Planet name="Earth" image="/Earth.jpg" size={40} />
    <span>Level: Earth Orbit</span>
</div>
```

### Menu Backgrounds
```jsx
// Large decorative planets
<div className="absolute inset-0 overflow-hidden">
    <Planet name="Jupiter" image="/Jupiter.jpg" size={300} />
</div>
```

### Loading Screens
```jsx
// Spinning planet as loader
<div className="flex flex-col items-center">
    <Planet name="Earth" image="/Earth.jpg" size={80} />
    <p>Loading...</p>
</div>
```
