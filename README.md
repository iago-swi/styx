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

## Structure

```text
styx/
|-- Claude/    # version built with Claude
|-- ChatGPT/   # version built with ChatGPT
|-- index.html # shared landing page
`-- README.md
```

Read the [original Styx instructions](https://www.digger.org/styx/howplay.htm).
