# Matchstick 7-Segment Puzzle

A fun and visual number puzzle — move the glowing segments on a digital clock-style display to form the biggest or smallest number you can.

---

## What is this?

You know those digital displays on clocks and calculators?
Each digit is made of 7 small lines called **segments**.

This puzzle lets you **move those segments around** to change the digits.
The goal is simple:

- **Largest mode** → rearrange segments to get the highest possible number
- **Smallest mode** → rearrange segments to get the lowest possible number

You choose how many moves you are allowed (1 to 6), and the solver finds the best answer instantly.

---

## How to play

1. Type a number (up to 6 digits)
2. Pick how many moves you want to allow
3. Choose Largest or Smallest
4. Hit **Solve** — the app shows you the best result and exactly which segments to move

---

## Example

Starting number: **45**, max moves: **3**, goal: **Largest**

- Move 1: take the middle segment from digit 2, place it on top of digit 1
- Move 2: take the bottom segment from digit 2, place it on the bottom of digit 1
- Move 3: take the left-top segment from digit 2, place it on the right of digit 2

Result: **97** ✅

---

## How it works (for the curious)

- Each digit is stored as a set of active segments (a through g)
- The solver uses a **two-phase approach**:
  - **Phase 1** — figures out which digits to target (fast math)
  - **Phase 2** — finds the exact segment moves to get there (smart search)
- Runs in a **Web Worker** so the page never freezes

---

## Built with

- Plain HTML, CSS, JavaScript
- No frameworks, no libraries, no install needed
- Just open `index.html` in any browser

---

## Live demo

👉 [Play it here](https://your-username.github.io/matchstick-puzzle/)

---

Made by **Hritik** · [GitHub](https://github.com/your-username)

