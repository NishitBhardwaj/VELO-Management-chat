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

VELO is a full-stack, enterprise-grade messaging and management application explicitly built on a microservices-ready architecture. Seamlessly fusing everyday chat mechanics with powerful organizational tools like Group Management, Video Meetings, and dynamic User Profiles.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 💬 **Real-Time Direct & Group Chat** | Instant messaging via Socket.IO. Supports 1:1 and fully featured Group Chats. |
| 👥 **Advanced Group Management** | Create Private/Public groups, generate unique invite codes/links, assign roles (Owner, Admin, HR), and toggle admin-only broadcast messaging. |
| 🎥 **Integrated Video Meetings** | One-click Jitsi Meet integration natively built into group chats allowing you to schedule and instantly launch virtual rooms. |
| 👤 **Comprehensive User Profiles** | Beautiful light-themed customizable profile pages supporting avatars, bios, organizations, positions, and dynamic social/portfolio links. |
| 🔐 **Robust Authentication** | Email/password, Google OAuth 2.0, OTP-based specific Password Reset logic alongside secure JWT session management. |
| 📇 **Contacts & Networking** | Search users globally, send/accept/reject connection requests, and manage active network contacts. |
| 💾 **Persistent History** | All direct and group messages securely stored in PostgreSQL with intelligent, cursor-based pagination. |
| 🎨 **Stunning UI/UX** | Seamless tabs, smooth CSS variable-driven light/dark foundations, responsive modaling and auto-scroll tracking. |

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

## 💬 How Real-Time Chat & Groups Work

```
User A (Browser)                                User B (Browser)
    │                                                ▲
    │ socket.emit('send_group_message')              │ socket.on('new_group_message')
    ▼                                                │
┌─────────────────────────────────────────────────────────┐
│              Auth Service (NestJS + Socket.IO)           │
│                                                         │
│  1. Check User permissions & active JWT                 │
│  2. If Admin-only group, verify User role constraints   │
│  3. Persist group message to DB under group chat ID     │
│  4. Broadcast strictly to users in specific group room  │
└─────────────────────────────────────────────────────────┘
```

- **Socket.IO Rooms**: Every user connects and is immediately auto-joined into their respective `{groupId}` Socket rooms via efficient TypeORM mapping.
- **REST Integrations**: Fully RESTful interface backing the dynamic generation of group invite codes and managing User-to-Group M:N relationships.

---

## 📂 Directory Structure

```text
VELO-Management-chat/
├── apps/
│   ├── api-gateway/        # GraphQL gateway routing to microservices
│   ├── auth-service/       # Auth (JWT, OAuth, OTP), Groups, Users, WebSockets
│   │   └── src/
│   │       ├── auth/       # Auth logic & OTP verification
│   │       ├── chat/       # Socket.IO Gateway, Message Persistence
│   │       ├── groups/     # Group CRUD, Members, Meetings, Role Mgmt
│   │       └── users/      # Profiles, Social Links, Connections
│   ├── broadcast-service/  # Fan-out worker for system-wide announcements
│   ├── chat-service/       # Kafka-powered message router + Cassandra persistence
│   ├── email-service/      # SMTP/IMAP integration and email classification
│   ├── hr-service/         # Org structures, attendance, RBAC, points system
│   ├── media-service/      # Image processing + MinIO storage
│   └── web-client/         # React + Vite + Socket.IO frontend
│       └── src/
│           ├── pages/Auth/ # Login, Register, Forgot Password
│           ├── pages/Chat/ # Sidebar, Group/DM routing, Modals (Meetings/CreateGroup)
│           └── pages/Profile/# User Profile customization UI
├── infrastructure/         # Docker configs & SQL init scripts
├── install_all.sh          # Dependency initialization
├── start_all.sh            # Global boot sequence
└── .env                    # System-wide variables
```

---

## 🔌 Core API Endpoints

### Auth (`/auth`)
- `POST /auth/register`, `/auth/login`: Core authentication.
- `GET /auth/google`: OAuth entrance.
- `POST /auth/forgot-password`, `/auth/verify-otp`: Secure OTP resets mapped direct to active browser notifications.

### Profile & Contacts (`/users`)
- `GET /users/profile/full`: Fetch massive profile payload including bio and dynamic social configurations.
- `POST /users/connections`: Ping other users to establish direct chats.
- `GET /users/contacts`: Load established contacts for DM capability.

### Groups & Meetings (`/groups`)
- `POST /groups`: Stand up a new Group environment.
- `POST /groups/join`: Accepts unique 8-car invite codes to merge users into a specific group.
- `POST /groups/:id/meetings`: Drops a Jitsi Meet calendar invite securely inside the specific Group context.

### Chat Engine (`/chat`)
- `GET /chat/:contactId/messages`: Cursor-paginated direct message historical payload.
- `GET /groups/:id/messages`: Cursor-paginated group history payload.

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
