# VELO Messenger App

VELO is a sophisticated, full-stack enterprise messaging and management application. It is built as a microservices architecture using NestJS for the backend services and React (Vite) for the frontend web client.

## 🚀 Getting Started

### Prerequisites
Before running the application, ensure you have the following installed on your system:
- **Node.js** (v20+ recommended)
- **pnpm** (Package manager)
- **Docker** & **Docker Compose** (for running databases and message brokers)

### 1. Environment Setup
The application requires several infrastructure components. Ensure you configure your `.env` file in the root directory. Required external services:
- **PostgreSQL** (Relational Database)
- **Redis** (Caching & Pub/Sub)
- **Kafka** (Message Broker)
- **Cassandra** (High-volume Message Storage)
- **MinIO** (S3-compatible Object Storage for Media)

### 2. Start the Infrastructure
Make sure your Docker engine is running, then boot up the required infrastructure (databases, caches, etc.):
```bash
docker compose up -d
```

### 3. Install Dependencies
Install all required Node.js packages across the monorepo:
```bash
# We have provided a script for convenience
chmod +x install_all.sh
./install_all.sh

# Or manually run:
pnpm install
```

### 4. Start the Application Stack
You can start all backend microservices and the Vite frontend development server simultaneously using the provided startup script:
```bash
chmod +x start_all.sh
./start_all.sh
```

Once started:
- The **Frontend Web Client** will be available at `http://localhost:5173`
- The **API Gateway / Auth Service** runs on port `3001`
- Other microservices run dynamically in the background (ports `3000`, `3002`-`3006`).

**Note on Linux File Watchers:** If the `web-client` crashes with an `ENOSPC` file watcher error, you need to increase your inotify limit:
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

---

## 📂 Directory Structure

The project is organized as a monorepo, separating different business domains into individual scalable microservices.

```text
VELO-Management-chat/
├── apps/
│   ├── api-gateway/       # API Gateway routing requests to underlying services
│   ├── auth-service/      # Handles User Registration, JWTs, and Google OAuth 2.0
│   ├── broadcast-service/ # Fan-out worker for system-wide announcements
│   ├── chat-service/      # Real-time WebSocket Gateway & Cassandra message store
│   ├── email-service/     # SMTP/IMAP integrations and email classification
│   ├── hr-service/        # Management of Org structures, attendance, and RBAC
│   ├── media-service/     # Image processing and MinIO storage integration
│   └── web-client/        # React + Vite frontend application
├── infrastructure/
│   └── docker/            # Docker configurations and init scripts (e.g., Postgres)
├── docker-compose.yml     # Local environment orchestration
├── install_all.sh         # Global dependency installation script
├── start_all.sh           # Script to boot all services in development mode
└── README.md
```

## 🔐 Google OAuth Configuration
To allow users to sign in via Google:
1. Go to your [Google Cloud Console](https://console.cloud.google.com/).
2. Create an **OAuth 2.0 Web Application Client**.
3. Set the authorized redirect URI to `http://localhost:3001/auth/google/callback`.
4. Add the generated Client ID and Client Secret to your `.env` file under `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Restart the backend servers to apply the new credentials.
