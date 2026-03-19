# VELO — Real-Time Messaging & Management Platform

<div align="center">

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

</div>

VELO is a full-stack, enterprise-grade messaging and management application built as a microservices architecture. It features **real-time WebSocket messaging**, user authentication (email/password + Google OAuth), contact management with connection requests, and a sleek dark-mode UI.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔐 **Authentication** | Email/password registration & login, Google OAuth 2.0, JWT-based sessions |
| 💬 **Real-Time Chat** | Instant messaging via Socket.IO WebSockets — messages appear in milliseconds |
| 📇 **Contact System** | Search users by email, send connection requests (accept/reject), manage contacts |
| 💾 **Message Persistence** | All messages stored in PostgreSQL with cursor-based pagination |
| 🟢 **Online Presence** | Live connection status indicator in the sidebar |
| 🎨 **Modern UI** | Dark glassmorphism design, stable avatar colors, auto-scroll, empty states |
| 🏗️ **Microservices** | Independently deployable services communicating via Kafka & Redis |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v20+
- **npm** (for backend) / **pnpm** (for web-client)
- **Docker** & **Docker Compose** (for databases & message brokers)

### 1. Clone & Install
```bash
git clone https://github.com/NishitBhardwaj/VELO-Management-chat.git
cd VELO-Management-chat

# Install all dependencies across the monorepo
chmod +x install_all.sh
./install_all.sh
```

### 2. Environment Setup
Create a `.env` file in the project root:
```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=velo
POSTGRES_PASSWORD=velo_dev_2026
POSTGRES_DB=velo_db

# Auth
JWT_SECRET=your-jwt-secret-here

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Start Infrastructure
```bash
docker compose up -d
```
This boots PostgreSQL, Redis, Kafka, Zookeeper, Cassandra, and MinIO.

### 4. Start the Application
```bash
chmod +x start_all.sh
./start_all.sh
```

### 5. Access the App
| Service | URL |
|---------|-----|
| **Frontend (React)** | http://localhost:5173 |
| **Auth Service API** | http://localhost:3001 |
| **API Gateway** | http://localhost:3000 |
| **Kafka UI** | http://localhost:8080 |
| **MinIO Console** | http://localhost:9001 |

---

## 💬 How Real-Time Chat Works

```
User A (Browser)                                User B (Browser)
    │                                                ▲
    │ socket.emit('send_message')                    │ socket.on('new_message')
    ▼                                                │
┌─────────────────────────────────────────────────────────┐
│              Auth Service (NestJS + Socket.IO)           │
│                                                         │
│  1. JWT verified on WebSocket handshake                 │
│  2. Message persisted to PostgreSQL                     │
│  3. Routed to recipient's socket in real-time           │
└─────────────────────────────────────────────────────────┘
```

- **Deterministic Chat IDs**: `dm:sorted(userA, userB)` ensures both users always share the same conversation thread
- **Message History**: `GET /chat/:contactId/messages` loads paginated history from PostgreSQL
- **Typing Indicators**: Ephemeral WebSocket events (not persisted)

---

## 📂 Directory Structure

```text
VELO-Management-chat/
├── apps/
│   ├── api-gateway/        # GraphQL gateway routing to microservices
│   ├── auth-service/       # Auth (JWT, Google OAuth) + Users + Connections + Chat WebSocket
│   │   └── src/
│   │       ├── auth/       # AuthController, AuthService, JwtStrategy, GoogleStrategy
│   │       ├── chat/       # ChatGateway (Socket.IO), ChatService, ChatController
│   │       └── users/      # UsersController, ConnectionsService, Connection entity
│   ├── broadcast-service/  # Fan-out worker for system-wide announcements
│   ├── chat-service/       # Kafka-powered message router + Cassandra persistence
│   ├── email-service/      # SMTP/IMAP integration and email classification
│   ├── hr-service/         # Org structures, attendance, RBAC, points system
│   ├── media-service/      # Image processing + MinIO storage
│   └── web-client/         # React + Vite + Socket.IO frontend
│       └── src/
│           └── pages/Chat/ # Chat.tsx, AddContactModal.tsx
├── infrastructure/
│   └── docker/             # Docker configs and Postgres init scripts
├── docker-compose.yml      # Local infra orchestration (6 services)
├── install_all.sh          # Install deps for all apps
├── start_all.sh            # Boot all services in dev mode
└── .env                    # Environment variables (gitignored)
```

---

## 🔌 API Endpoints

### Auth (`/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with email/password |
| POST | `/auth/login` | Login and receive JWT |
| GET | `/auth/google` | Initiate Google OAuth flow |
| GET | `/auth/me` | Get authenticated user profile |
| PUT | `/auth/profile` | Update display name, avatar, etc. |

### Users & Contacts (`/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/search?email=` | Search user by exact email |
| POST | `/users/connections` | Send a connection request |
| GET | `/users/connections/pending` | Get incoming pending requests |
| PUT | `/users/connections/:id` | Accept or reject a request |
| GET | `/users/contacts` | Get all accepted contacts |

### Chat (`/chat`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chat/:contactId/messages` | Load message history (paginated) |
| WS | `send_message` | Send a message via WebSocket |
| WS | `new_message` | Receive a message via WebSocket |
| WS | `typing` | Send/receive typing indicator |

---

## 🔐 Google OAuth Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create an **OAuth 2.0 Web Application Client**
3. Set redirect URI to `http://localhost:3001/auth/google/callback`
4. Add Client ID and Secret to your `.env` file
5. Restart the backend servers

---

## 🐧 Linux Troubleshooting
If the frontend crashes with `ENOSPC` file watcher error:
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

---

## 📜 License
This project is private and unlicensed.
