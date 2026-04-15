# Noa Jump

Noa Jump is a lightweight browser arcade game where two illustrated stick-figure characters bounce upward on trampolines in an endless climb.

## How To Run

No build step is required.

1. Open `index.html` in a browser.
2. Press the left or right arrow key to start.

## Controls

- `Left Arrow`: move left
- `Right Arrow`: move right

The characters bounce automatically. If they miss a trampoline and fall below the visible frame, the run ends.

## Game Notes

- Endless upward trampoline gameplay
- Browser scroll follows the climb from the bottom of the frame upward
- Best score is saved in the browser with `localStorage`
- Custom Noa branding and character artwork are included as local image assets

## Project Files

- `index.html`: page structure and HUD
- `styles.css`: layout, colors, and responsive styling
- `game.js`: gameplay loop, rendering, controls, and scrolling behavior
- `characters-reference.png`: character artwork reference
- `noa-logo.png`: Noa logo asset
