# Styx

A modern territory-capture arcade game inspired by Styx and Qix, built in three versions to compare what different AI assistants produce from the same brief. Steer across open space, reconnect with the border, and claim most of the field before the roaming enemy touches your unfinished line.

**Play it in your browser: <https://iago-swi.github.io/styx/>**

| Version | Play | Source and controls |
| --- | --- | --- |
| Claude · Vitrail | [Play](https://iago-swi.github.io/styx/Claude/) | [Claude/](Claude/) |
| ChatGPT · Vector Arcade | [Play](https://iago-swi.github.io/styx/ChatGPT/) | [ChatGPT/](ChatGPT/) |
| Gemini · Neon Abyss | [Play](https://iago-swi.github.io/styx/Gemini/) | [Gemini/](Gemini/) |

To play offline, download or clone this repository and open `index.html` in your browser. It is a landing page that links to all versions. Each version is self-contained in its own folder, with its own README.

## Claude version

In **Vitrail**, you are a diamond glass-cutter. Cut across the dark and seal a region before the drifting Wisp touches your open line, and it lights up as a pane of stained glass. Light 75% of a window to finish it, and see how many windows your three diamonds last. Finished games can enter the high-score list on the device and the one shared between players. [Play Vitrail](https://iago-swi.github.io/styx/Claude/) · [Controls and technical notes](Claude/README.md)

![Vitrail gameplay: sealed panes of stained glass around a dark area where the Wisp drifts](Claude/screenshot.jpg)

## ChatGPT version

In **Vector Arcade**, steer a white diamond across a nebula and close your trail before the pink Styx reaches it. The side cut off from the Styx becomes yours. Claim 80% to advance, then see how far your three lives take you. Finished runs can earn a place on the device or shared high-score board. [Play Vector Arcade](https://iago-swi.github.io/styx/ChatGPT/) · [Controls and technical notes](ChatGPT/README.md)

![Vector Arcade gameplay: a cut in progress on a teal-bordered field, with the pink Styx swirling over a nebula and a score panel on the right](ChatGPT/screenshot.jpg)

## Gemini version

In **Neon Abyss**, carve in 8 directions across a gravitationally warped nebula and seal regions to crystallize five procedural stained-glass realms under WebGL 2 HDR bloom. Time closures to the cycling ×1 / ×5 / ×10 multiplier, crush border caterpillars, and claim 80% to advance. Finished runs can enter the high-score list on the device and the shared board between players. [Play Neon Abyss](https://iago-swi.github.io/styx/Gemini/) · [Controls and technical notes](Gemini/README.md)

![Neon Abyss gameplay: cyan, magenta, and solar gold hexagonal crystal panels framing a warped nebula grid where the iridescent Styx swirls near an active carving tether](Gemini/screenshot.jpg)

## Game history

In 1981, Taito released *Qix* in arcades. To claim part of the screen, you had to leave its edge, draw a line through open space, and reach safety before the Qix touched the line. A cut across the entire screen could win a huge area, but it also gave the enemy longer to intercept you. [Taito’s original arcade flyer](https://flyers.arcade-museum.com/arcades/show/794) · [Museum of the Game](https://www.arcade-museum.com/Videogame/qix)

In 1983, Windmill Software released *Styx* for the IBM PC/XT on a bootable 5¼-inch floppy disk. Its take on the idea allowed diagonal cuts and set the target at 80% of the field. Timing mattered as much as size for a high score. A cycling color indicator made the same patch of territory worth one, five, or ten times its base value. [Styx archive](https://www.digger.org/styx/) · [Original controls and scoring](https://www.digger.org/styx/howplay.htm)

The original depended on IBM’s Color Graphics Adapter (CGA). In 1998, Andrew Jenner made a version that ran on PCs with newer graphics hardware. The three browser games in this repository revisit the same territory-cutting mechanic—in stained glass, vector arcade, and WebGL2 neon crystal. [Styx archive’s account of the 1998 version](https://www.digger.org/styx/)

## Structure

```text
styx/
|-- Claude/    # version built with Claude
|-- ChatGPT/   # version built with ChatGPT
|-- Gemini/    # version built with Gemini
|-- index.html # shared landing page
`-- README.md
```
