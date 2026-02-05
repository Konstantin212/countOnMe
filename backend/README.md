# CountOnMe Backend

FastAPI backend for CountOnMe using **async SQLAlchemy**, **Alembic**, and **PostgreSQL**.

## Local dev (Docker)

1) Copy env template:

- `cp env.example .env`

2) Start services:

- `docker compose -f docker-compose.yml up --build`

3) Open:

- API health: `http://localhost:8000/health`
- OpenAPI docs: `http://localhost:8000/docs`

