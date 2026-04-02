# Cellular Automata

A web-based interactive platform for exploring various cellular automata simulations. Built with a modern React frontend and Python backend, featuring real-time visualization of complex systems including Game of Life, Langton's Ant, Brian's Brain, and more.

## Features

- **Multiple Automata Models**: Game of Life, Elementary CA, Cyclic, Brian's Brain, Langton's Ant, Bacteria, Epidemic, Traffic, 3D Life, and more
- **Custom Rule Builder**: Create and test your own cellular automaton rules
- **Interactive Canvas**: Real-time visualization with controls for speed, pause/resume, and single-step progression
- **3D Visualization**: Support for 3D cellular automata
- **Responsive UI**: Modern, intuitive interface for easy exploration
- **Docker Support**: Containerized deployment for easy setup

## Project Structure

```text
.
├── backend/              # Python backend server
│   ├── main.py          # FastAPI/Flask application entry point
│   ├── automata/        # Cellular automata implementations
│   │   ├── game_of_life.py
│   │   ├── elementary.py
│   │   ├── langtons_ant.py
│   │   ├── brians_brain.py
│   │   └── ...
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── AutomataCanvas.jsx
│   │   │   ├── Canvas3D.jsx
│   │   │   ├── Controls.jsx
│   │   │   ├── CustomRuleBuilder.jsx
│   │   │   └── ...
│   │   └── api.js
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Getting Started

### Using Docker Compose (Recommended)

```bash
docker compose up --build
```

The application will be available at:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:8000](http://localhost:8000)

### Local Development

#### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Available Cellular Automata

- **Game of Life**: Classic Conway's Game of Life
- **Elementary Cellular Automata**: 1D cellular automata with 256 possible rules
- **Cyclic**: Cyclic automaton with color cycling
- **Brian's Brain**: Three-state variant of Game of Life
- **Langton's Ant**: Emergent behavior from simple rules
- **Bacteria**: Bacterial growth simulation
- **Epidemic**: Disease spread simulation
- **Traffic**: Vehicle traffic flow simulation
- **3D Life**: Game of Life extended to 3D
- **Custom Rules**: Define and test your own automaton rules

## Technology Stack

**Frontend:**

- React 18
- Vite
- Canvas API for 2D rendering
- Three.js or WebGL for 3D visualization

**Backend:**

- Python 3.x
- FastAPI/Flask
- NumPy for efficient computation

**Infrastructure:**

- Docker & Docker Compose
- Nginx (frontend reverse proxy)

## Contributing

Feel free to fork this project and submit pull requests for improvements, new automata models, or UI enhancements.

## License

[Add your license here]
