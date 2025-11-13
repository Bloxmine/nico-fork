// Example exported animation - a simple blinking pattern
// This is what you'll get when you click "Export JS" in the Animation Maker

const animation = {
  "frame_1": [
    [0,0,0,0,0],
    [0,1,1,1,0],
    [0,1,0,1,0],
    [0,1,1,1,0],
    [0,0,0,0,0],
  ],
  "frame_2": [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,1,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
  ],
};

// Example usage:
console.log('Animation has', Object.keys(animation).length, 'frames');
console.log('First frame:', animation.frame_1);
console.log('Frame dimensions:', animation.frame_1.length, 'x', animation.frame_1[0].length);

// Iterate through frames
Object.keys(animation).forEach((frameKey, index) => {
  console.log(`Frame ${index + 1}:`, animation[frameKey]);
});
