# Animation Export Feature

## Overview
You can now export animations from the Animation Maker in a JavaScript object format that's easy to use in your code.

## How to Export

1. Open the Animation Maker at `http://localhost:3000/anim`
2. Create or select an animation
3. Click the **📥 Export JS** button
4. A JavaScript file will be downloaded with your animation

## Export Format

The exported animation will be in the following format:

```javascript
const animation = {
  "frame_1": [
    [0,1,1,1,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  "frame_2": [
    [0,1,1,1,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  // ... more frames
};
```

## Format Details

- Each frame is represented as a 2D array
- `1` represents a white/on pixel
- `0` represents a black/off pixel
- The dimensions match your display size (typically 84×28 for the flipdot display)
- Frame names are sequential: `frame_1`, `frame_2`, etc.

## Using the Exported Animation

You can use the exported animation in your own code:

```javascript
// Import or copy the exported animation
const animation = { /* exported frames */ };

// Access individual frames
const firstFrame = animation.frame_1;

// Iterate through all frames
Object.keys(animation).forEach(frameKey => {
  const frame = animation[frameKey];
  // Process the frame...
});

// Get a specific pixel value
const pixelValue = animation.frame_1[row][col]; // Returns 0 or 1
```

## API Endpoint

The export functionality is also available via API:

```
GET /anim/export?name=<animation_name>
```

This will return a JavaScript file with the animation data.

## Example Use Cases

1. **Backup**: Save your animations as JavaScript files for version control
2. **Sharing**: Share animations with others in a simple, readable format
3. **Integration**: Import animations into other projects or tools
4. **Documentation**: Use the exported format to document animation patterns

## Notes

- The export preserves the exact pixel grid of your animation
- Each row in the 2D array represents one horizontal line of pixels
- The array dimensions are [height][width] where height is the number of rows
