# NOAH GAMING — Project Context & Handover Summary

This document summarizes the current architecture, implementation status, and active configuration for the NOAH GAMING project on `D:\gaming_cafe`.

---

## 1. Quick Reference & Conversation Linking

- **Previous Conversation ID**: `dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f`
- **To pull context in your new Antigravity workspace chat**:
  - Type `@` in the chat input and select **Conversations** → choose this conversation (`dda2b4f0-b0a3-4ddb-87f9-4ce03bd0a99f`), or
  - Mention this file with `@PROJECT_CONTEXT_HANDOVER.md`.

---

## 2. Project Architecture & Environments

### Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, PWA (Service Worker)
- **Backend**: Node.js (ESM), Express, Mongoose, JWT, Resend (Email), Razorpay, Web Push
- **Database**: MongoDB Atlas (`cluster0.1azkwms.mongodb.net/gaming_lounge`)

### Directory Structure
```text
D:\gaming_cafe
├── client/              # React/Vite Frontend
│   ├── src/             # Components, contexts, pages, styles
│   ├── .env.local       # Local client environment variables
│   └── index.html       # Entry HTML with mobile zoom & PWA meta
├── server/              # Node.js Express Backend
│   ├── src/             # Controllers, models, routes, middlewares, services
│   ├── data/backup/     # Production backups
│   └── .env             # Production/development secrets & API keys
└── PROJECT_CONTEXT_HANDOVER.md
```

---

## 3. Recently Implemented & Verified Systems

### A. Primary Admin Ownership Transfer (Complete & Verified)
- **New Primary Admin**: `royalofficial2004@gmail.com` (`Royal Dsouza`)
- **Database Status**: `isPrimaryAdmin: true`, `role: 'admin'`, `accountStatus: 'ACTIVE'`
- **Database Engine Constraint**: Enforced via MongoDB partial unique index on `{ isPrimaryAdmin: 1 }` with `{ unique: true, partialFilterExpression: { isPrimaryAdmin: true } }`. Exactly **one** Primary Admin can exist in the database.
- **Previous Admin**: `6af8109b11e34f99b5263277` (`Lounge Admin`) demoted to standard admin (`isPrimaryAdmin: false`). All 10 bookings, 6 payments, and 79 activity logs were preserved.
- **Backend RBAC Safeguards**:
  - `deleteUser`: Only Primary Admin can delete other admins. The Primary Admin account cannot be deleted.
  - `changeUserRole`: Only Primary Admin can grant or revoke admin roles. The Primary Admin cannot be demoted.
  - `updateUserDetails`: Guarded against unauthorized modifications by non-primary staff.
- **Configuration**: `PRIMARY_ADMIN_EMAIL=royalofficial2004@gmail.com` in `server/.env`.

### B. Mobile Zoom Restrictions (Complete & Verified)
- **Viewport Meta**:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  ```
- **Touch & Gesture Handling**:
  - `html, body { touch-action: pan-x pan-y; }` (smooth single-finger scrolling, no page zoom).
  - `button, a, input, select, textarea, [role="button"] { touch-action: manipulation; }` (eliminates 300ms tap delay and double-tap zoom).
  - iOS WebKit `gesturestart` listener prevents pinch-to-zoom bypass.
  - Mobile input font-size threshold: `font-size: 16px !important` on screens `≤ 768px` prevents iOS Safari from auto-zooming upon field focus.
  - **Desktop zoom**: Completely unaffected (Ctrl +/- and Ctrl + wheel work normally).

### C. Light Mode Visibility Fixes (Complete & Verified)
- **Customer Names in Booking & Walk-In**: Styled with `#171923` in Light Mode and `#FFF4E8`/`white` in Dark Mode across Admin Bookings Tab and Receptionist Front Desk.
- **Exclusive Game Cards**: Titles styled with `#171923` and descriptions with `#414858` against crisp light cards.
- **Floating Mobile Bottom Navigation**: Preserved with approved frosted glass appearance.

### D. Authentication, Profile Claim & Admin Assistance
- **Claim Your Profile**: Dual email or mobile number lookup with normalization.
- **Admin-Assisted OTP**: Dedicated `adminassistancerequests` table, kept separate from standard OTP manager.
- **Password Reset**: Always dispatches OTP to registered account email even if mobile number is entered.

---

## 4. Run & Development Commands

```bash
# Frontend (Client)
cd D:\gaming_cafe\client
npm install
npm run dev      # Local Vite dev server
npm run build    # Production build check

# Backend (Server)
cd D:\gaming_cafe\server
npm install
npm run dev      # Nodemon backend dev server
```
