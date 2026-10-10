"use strict";

/* The list of themes. Their colours, fonts and panels are in css/themes.css under [data-theme=id]
   and each animated background is js/scenes/<scene>.js. The names and art are all original, just
   loosely inspired by different kinds of game, with nothing taken from any actual game.
   family: scifi | fantasy | retro | wasteland (post-apoc, cyberpunk, survival) | plain */
window.RS_THEMES = [
  {
    id: "ringworld",
    name: "Ringworld",
    family: "scifi",
    scene: "ringworld",
    blurb: "An alien valley under a vast orbital ring",
  },
  {
    id: "starfarer",
    name: "Starfarer",
    family: "scifi",
    scene: "starfarer",
    blurb: "A vivid alien world, a ringed giant and your landed ship",
  },
  {
    id: "relay",
    name: "Relay",
    family: "scifi",
    scene: "relay",
    blurb: "A ring gate in orbit, ships jumping, a living world below",
  },
  {
    id: "lastcity",
    name: "Last City",
    family: "scifi",
    scene: "lastcity",
    blurb: "A walled city of towers under a vast pale sphere",
  },
  {
    id: "hellforge",
    name: "Hellforge",
    family: "scifi",
    scene: "hellforge",
    blurb: "Lava rivers, a burning refinery and a citadel of spires",
  },
  {
    id: "neon",
    name: "Neon City",
    family: "wasteland",
    scene: "neon",
    blurb: "Rain-slick megacity, holo signs and flying cars",
  },
  {
    id: "wasteland",
    name: "Wasteland",
    family: "wasteland",
    scene: "wasteland",
    blurb: "Green-screen terminal over a ruined skyline",
  },
  {
    id: "sanctum",
    name: "Sanctum",
    family: "fantasy",
    scene: "sanctum",
    blurb: "A ruined cathedral, a blood moon and a graveyard",
  },
  {
    id: "goldentree",
    name: "Golden Tree",
    family: "fantasy",
    scene: "goldentree",
    blurb: "A colossal glowing tree over misty ruins",
  },
  {
    id: "tavern",
    name: "Tavern",
    family: "fantasy",
    scene: "tavern",
    blurb: "A warm inn: a roaring hearth, the weather at the window",
  },
  {
    id: "blocks",
    name: "Blocks",
    family: "survival",
    scene: "blocks",
    blurb: "A floating voxel island with a waterfall",
  },
  {
    id: "frostpeak",
    name: "Frostpeak",
    family: "fantasy",
    scene: "frostpeak",
    blurb: "Snowy peaks, aurora and something with wings",
  },
  {
    id: "zone",
    name: "The Zone",
    family: "wasteland",
    scene: "zone",
    blurb: "An abandoned exclusion zone, anomalies and the odd blowout",
  },
  {
    id: "deep",
    name: "Deep",
    family: "wasteland",
    scene: "deep",
    blurb: "Kelp, sun shafts, a glowing habitat, and something big",
  },
  {
    id: "arcade",
    name: "Arcade",
    family: "retro",
    scene: "arcade",
    blurb: "Neon, cabinets and a claw machine after dark",
  },
  {
    id: "pocket",
    name: "Pocket",
    family: "retro",
    scene: "pocket",
    blurb: "A four-shade handheld world, scrolling by",
  },
  {
    id: "overworld",
    name: "Overworld",
    family: "retro",
    scene: "overworld",
    blurb: "16-bit fields, a castle, slimes and a hero",
  },
  { id: "minimal", name: "Minimal", family: "plain", scene: null, blurb: "No animation, lowest CPU" },
];

window.RS_FAMILIES = {
  scifi: "Sci-fi",
  fantasy: "Fantasy",
  retro: "Retro",
  wasteland: "Wasteland, neon & survival",
  plain: "Plain",
};
