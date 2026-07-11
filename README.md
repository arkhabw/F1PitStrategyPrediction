# RacePace AI - F1 Pit Strategy Optimizer 🏎️

RacePace AI is an interactive, premium web-based F1 Race Simulation & Pit Strategy Optimizer. Designed with motorsport paddock telemetry aesthetics, this application leverages an AI backtracking search algorithm to compute the mathematically optimal pit stop windows and compound choices for a given race scenario.

## Live Demo 🌐
`https://arkhabw.github.io/F1PitStrategyPrediction/`

---

## Key Features 🚀

- **AI Strategy Engine**: Evaluates thousands of compound and pit-lap combinations using backtracking search with branch-and-bound pruning in milliseconds.
- **Dynamic Weather Simulation**: Simulates gradual wetness buildup and drying on track surfaces, dynamically altering tyre grip and wear rates.
- **F1 Sporting Regulations Enforcement**: Automatically checks safety wear thresholds (<88% wear) and dry race rules (must use at least 2 unique slick compounds and perform 1+ pit stop).
- **Premium Paddock Telemetry UI**: Dark mode carbon-fiber mesh aesthetics, custom pill selectors, visual stint timelines, and interactive charts.
- **Visual Compare Mode**: View and compare AI recommendation timelines side-by-side with alternative strategies.
- **PDF Strategy Export**: Download clean, pre-formatted PDF strategy reports with one click.

---

## Technical Specifications 🛠️

- **Core Physics & Math**: 
  - *Fuel Weight Effect*: Lap times speed up linearly as the fuel weight burns off (~0.06s faster per lap).
  - *Tyre Degradation*: Non-linear performance loss that models "cliffing" beyond 70% wear.
  - *Dampness grip scaling*: Slick tyres experience a quadratic drop-off in grip when track wetness exceeds 10%, while intermediate and wet tyres scale dynamically inside their optimal humidity bounds.
- **Tech Stack**:
  - HTML5, Vanilla CSS3 (Custom properties, grid, flexbox, glassmorphism).
  - Vanilla ES6 JavaScript (Simulation physics, optimization engine, DOM logic).
  - [Chart.js](https://www.chartjs.org/) (Dynamic telemetry charts).
  - Google Fonts (Outfit, JetBrains Mono).

---

## Installation & Local Setup 💻

Since this is a fully static client-side web application, it requires no compilers, backend servers, or package installs:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/arkhabw/F1PitStrategyPrediction.git
   cd F1PitStrategyPrediction
   ```
2. **Open in browser**:
   Double click the `index.html` file or drag it directly into any modern web browser (Chrome, Edge, Firefox, Safari).

---

## Developer Roadmap 🗺️

- [x] Implement core simulation engine & Dynamic Programming search.
- [x] Build dark mode glassmorphism user interface.
- [x] Fix pit-stop count bugs in alternative stint options.
- [x] Add dynamic weather segments builder.
- [x] Build English localisation.
- [x] Integrate PDF printing & Visual Compare Mode.
- [ ] Add real-time driver gap calculations (Traffic simulation).
- [ ] Implement safety car probability simulations.
