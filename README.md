# CountOnMe

A fast, offline-first calorie tracking app built with React Native (Expo) and FastAPI.

## Project Structure

```
countOnMe/
├── .env                  # Environment variables (gitignored)
├── .env.example          # Example environment configuration
├── docker-compose.yml    # Docker services (PostgreSQL + API)
├── backend/              # FastAPI backend
│   ├── Dockerfile
│   ├── app/              # Application code
│   ├── alembic/          # Database migrations
│   └── pyproject.toml    # Python dependencies
└── client/               # React Native (Expo) app
    ├── src/              # Application code
    ├── assets/           # Images and icons
    └── package.json      # Node dependencies
```

## Quick Start

### 1. Environment Setup

Copy the example environment file and update with your settings:

```bash
cp .env.example .env
```

Update `EXPO_PUBLIC_API_URL` with your local IP address (find it with `ipconfig` on Windows or `ifconfig` on Mac/Linux).

### 2. Start the Backend

```bash
# Start PostgreSQL and API
docker-compose up -d

# Run database migrations
docker-compose exec api alembic upgrade head
```

The API will be available at `http://localhost:8000`.

### 3. Start the Client

```bash
cd client
pnpm install
pnpm start
```

Scan the QR code with Expo Go app on your phone, or press `a` for Android emulator.

## Development

### Backend

- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Framework**: FastAPI with async SQLAlchemy
- **Database**: PostgreSQL 16

```bash
# View logs
docker-compose logs -f api

# Run migrations
docker-compose exec api alembic upgrade head

# Create new migration
docker-compose exec api alembic revision --autogenerate -m "description"
```

### Client

- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation 7
- **State**: React hooks + AsyncStorage

```bash
cd client

# Run tests
pnpm test

# Start with cache clear
pnpm start --clear
```

## Environment Variables

See `.env.example` for all available configuration options.

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API URL for mobile app | `http://localhost:8000` |
| `DATABASE_URL` | PostgreSQL connection string | Docker network URL |
| `DEVICE_TOKEN_PEPPER` | Secret for device token hashing | `change-me` |
