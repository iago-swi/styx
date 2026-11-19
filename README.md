# Styx

A modern territory-capture arcade game inspired by Styx and Qix, built in two versions to compare what different AI assistants produce from the same brief. Steer across open space, reconnect with the border, and claim most of the field before the roaming enemy touches your unfinished line.

**Play it in your browser: <https://iago-swi.github.io/styx/>**

| Version | Play | Source and controls |
| --- | --- | --- |
| Claude · Vitrail | [Play](https://iago-swi.github.io/styx/Claude/) | [Claude/](Claude/) |
| ChatGPT · Vector Arcade | [Play](https://iago-swi.github.io/styx/ChatGPT/) | [ChatGPT/](ChatGPT/) |

To play offline, download or clone this repository and open `index.html` in your browser. It is a landing page that links to both versions. Each version is self-contained in its own folder, with its own README.

## Claude version

![Vitrail gameplay: sealed panes of stained glass around a dark area where the Wisp drifts](Claude/screenshot.jpg)

## ChatGPT version

![Vector Arcade gameplay: a cut in progress on a teal-bordered field, with the pink Styx swirling over a nebula and a score panel on the right](ChatGPT/screenshot.jpg)

## Game history

In 1981, Taito released *Qix* in arcades. To claim part of the screen, you had to leave its edge, draw a line through open space, and reach safety before the Qix touched the line. A cut across the entire screen could win a huge area, but it also gave the enemy longer to intercept you. [Taito’s original arcade flyer](https://flyers.arcade-museum.com/arcades/show/794) · [Museum of the Game](https://www.arcade-museum.com/Videogame/qix)

In 1983, Windmill Software released *Styx* for the IBM PC/XT on a bootable 5¼-inch floppy disk. Its take on the idea allowed diagonal cuts and set the target at 80% of the field. Timing mattered as much as size for a high score. A cycling color indicator made the same patch of territory worth one, five, or ten times its base value. [Styx archive](https://www.digger.org/styx/) · [Original controls and scoring](https://www.digger.org/styx/howplay.htm)

The original depended on IBM’s Color Graphics Adapter (CGA). In 1998, Andrew Jenner made a version that ran on PCs with newer graphics hardware. The two browser games in this repository revisit the same territory-cutting mechanic, one in stained glass and the other over a nebula. [Styx archive’s account of the 1998 version](https://www.digger.org/styx/)

## Structure

```text
styx/
|-- Claude/    # version built with Claude
|-- ChatGPT/   # version built with ChatGPT
|-- index.html # shared landing page
`-- README.md
```
