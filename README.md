# Draw Buddy

Draw Buddy is a real-time collaborative whiteboard. Create a room, share its URL, and draw together on an infinite canvas.

## Features

- Real-time room-based collaboration with live cursor indicators
- Drawing tools for selection, pan, pencil, rectangles, circles, lines, text, and erasing
- Move, resize, delete, and reorder shapes with a layers panel
- Canvas pan and zoom controls
- Per-user undo and redo history
- JSON export for the current drawing
- Optional PostgreSQL persistence for room snapshots

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand, and Socket.IO Client
- Backend: Node.js, Express, TypeScript, and Socket.IO
- Persistence: Prisma with PostgreSQL (optional)

## Project Structure

```text
draw-buddy/
|-- frontend/             # React canvas application
|   `-- src/
|       |-- components/   # Canvas, toolbar, layers, and room UI
|       |-- hooks/        # Socket and history behavior
|       |-- store/        # Zustand canvas state
|       `-- utils/        # Geometry, serialization, and shape helpers
|-- backend/              # Express and Socket.IO server
|   |-- prisma/           # Optional PostgreSQL schema
|   `-- src/
|       |-- services/     # Room state and persistence services
|       `-- sockets/      # Real-time event handlers
`-- README.md
```

## Prerequisites

- Node.js 18 or later
- PostgreSQL only when durable room persistence is required

## Run Locally

Install dependencies and start the backend in one terminal:

```bash
cd backend
npm install
npm run dev
```

Start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite, normally `http://localhost:5173`. Create a room and open or share the resulting URL in another browser tab to collaborate.

## Environment Variables

Copy the example environment files before customizing them:

```bash
cd backend
cp .env.example .env

cd ../frontend
cp .env.example .env
```

| Location | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `PORT` | HTTP and Socket.IO server port. Defaults to `4000`. |
| `backend/.env` | `CLIENT_ORIGIN` | Allowed frontend origin for CORS. Defaults to `http://localhost:5173`. |
| `backend/.env` | `DATABASE_URL` | PostgreSQL connection string. Enables Prisma-backed room persistence when set. |
| `frontend/.env` | `VITE_SOCKET_URL` | Backend Socket.IO URL. Defaults to `http://localhost:4000`. |

## Optional Database Persistence

Without `DATABASE_URL`, rooms are held in server memory and the application works normally. To persist room snapshots across server restarts, configure a PostgreSQL database and run:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

## Production Build

```bash
cd backend
npm run build
npm start
```

```bash
cd frontend
npm run build
```

The frontend build is written to `frontend/dist`. Set `CLIENT_ORIGIN` and `VITE_SOCKET_URL` to the deployed application URLs before building and deploying.

## API Endpoints

The backend exposes lightweight diagnostics endpoints:

- `GET /health` returns server status and uptime.
- `GET /api/rooms` returns active in-memory room IDs.
- `GET /api/rooms/:roomId` returns the current room snapshot.

## Collaboration Model

When someone joins a room, they receive the current canvas snapshot. New shapes, edits, deletions, layer order changes, and cursor movement are then sent as small Socket.IO events, keeping collaboration responsive without repeatedly sending the full canvas.
