# NOAH GAMING | PLAY • CHILL • CONNECT

A modern, full-stack Gaming Lounge Management and Online Booking Platform designed for customers, front-desk staff, and administrators.

---

## 🛠️ Technology Stack

- **Frontend**: React.js 18 with Vite, Tailwind CSS, Lucide React
- **Backend**: Node.js & Express.js REST API
- **Database**: MongoDB (Local or MongoDB Atlas) with Mongoose ODM
- **Payment Gateway**: Razorpay (Dual-Mode: Test simulation & Live keys)
- **Email Delivery**: Resend SDK (Transactional booking receipts, 2FA, OTPs, welcome emails)
- **Authentication**: Stateless JSON Web Tokens (JWT) + pre-save Bcrypt hashing + Email 2FA
- **Timezone**: Indian Standard Time (`Asia/Kolkata`) for all bookings, sessions, and logs
- **Architecture**: Modular Monorepo with strict separation of concerns, Role-Based Access Control (RBAC), and full audit trails

---

## 🌟 Key Features

1. **Online & Receptionist Booking System**:
   - Device availability engine with slot collision detection and concurrency locks.
   - Game-specific player capacities (`minPlayers`, `maxPlayers`) and booking modes (`SHARED`, `PRIVATE_ONLY`, `BOTH`).
   - Dynamic per-player and per-hour price calculation with advance payment support.

2. **User Management & Guest-to-Registered Account Conversion**:
   - Unified customer management for Front Desk and Admin.
   - Zero-data-loss Guest-to-Registered conversion via 6-digit email OTP.
   - Admin account deletion with confirmation prompt and active-session safeguards.
   - Comprehensive customer profile timeline (Bookings, Sessions, Payments, Passes, Audit Logs).

3. **Customer Security & 2FA**:
   - Secure email-based OTP verification with 5-minute expiry and 60s cooldown.
   - Optional 2FA challenge on customer sign-in.
   - Hashed OTP storage and anti-reuse protection.

4. **Payments & Financial Reconciliation**:
   - Seamless Razorpay checkout modal with instant webhook verification.
   - Financial audit trail and daily settlement logs.
   - PDF receipt generation for completed bookings.

5. **Front Desk & Admin Controls**:
   - Live hardware status dashboard with active session timers and overtime tracking.
   - Device and Game management (PS5 consoles, Pool tables, VIP suites).
   - Activity audit logging for administrative actions.

---

## 📁 Project Structure

```
gaming_cafe/
├── client/                      # React 18 + Vite + Tailwind CSS Frontend
│   ├── index.html
│   ├── vite.config.js           # Proxies /api to http://localhost:5000
│   ├── tailwind.config.js       # Gaming dark palette & neon accent theme
│   ├── src/
│   │   ├── api/                 # API client services (auth, bookings, payments, userManagement)
│   │   ├── context/             # AuthContext, NotificationContext
│   │   ├── components/          # Reusable UI components & modals
│   │   ├── pages/               # Application views
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                      # Node.js + Express + MongoDB Backend
│   ├── .env.example             # Template for environment variables
│   ├── src/
│   │   ├── config/              # Database connection, constants, and seeds
│   │   ├── models/              # Mongoose models (User, Booking, Device, Game, Payment, etc.)
│   │   ├── middlewares/         # JWT authentication, RBAC guards, validation, rate limiting
│   │   ├── controllers/         # REST API endpoint handlers
│   │   ├── routes/              # Express route declarations
│   │   ├── services/            # Business logic (email, booking, razorpay)
│   │   ├── scripts/             # Database seeding, migration, and verification suites
│   │   ├── app.js               # Express application initialization
│   │   └── server.js            # Server entrypoint
│   └── package.json
├── .gitignore                   # Comprehensive exclusions for sensitive files & dependencies
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- MongoDB (Local instance or MongoDB Atlas cluster)

### 2. Backend Setup
```bash
cd server
cp .env.example .env
# Fill in your MONGODB_URI and JWT_SECRET in server/.env
npm install
npm run seed       # Seeds initial accounts, devices, categories, and settings
npm run dev        # Starts backend API on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

---

## ⚡ Default Seed Accounts

| Role | Name | Email | Mobile | Password |
|---|---|---|---|---|
| **Administrator** | Lounge Admin | `admin@gaminglounge.com` | `9876543210` | `AdminPassword@123` |
| **Receptionist** | Front Desk Reception | `reception@gaminglounge.com` | `9876543211` | `StaffPassword@123` |
| **Customer** | Aryan Sharma | `customer@gaminglounge.com` | `9876543212` | `CustomerPassword@123` |

---

## 🛡️ License
ISC
