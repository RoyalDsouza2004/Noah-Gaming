# NOAH GAMING: Front Desk Fixes Progress

## 1. Identified Root Causes

### Part 1: Physical Station Status
- **Root Cause of GTA 6 on every session**:
  1. In `client/src/components/receptionist/ReceptionistDashboard.jsx` (lines 964, 978-982), `isExclusive` was defined as `session.game?.isExclusive || session.bookingType === 'PRIVATE'`. Because of this conflation, every private session (including standard PS5 games like EA Sports FC 24 or pool) was tagged with a badge reading `GTA 6`.
  2. In `Physical Station Status` cards (line 792), `isGTA6` was defined as `currentSession?.gameName?.includes('GTA') || currentSession?.isExclusiveGame`, displaying the `GTA 6 Exclusive Lock (₹150/hr)` banner for any exclusive or private session.
  3. In `server/src/services/receptionist.service.js` (line 165), `gameName` defaulted to `'Open Title'` instead of checking `isVenueSelection ? 'Select Game at Venue' : (primarySession.game?.name || primarySession.gameTitle || 'Game Not Selected')`.
- **Root Cause of Private Session on every booking & Player Count Discrepancies**:
  1. In `ReceptionistDashboard.jsx` (line 330), when creating walk-in bookings, `numberOfPlayers: isExclusiveGame || bookingType === 'PRIVATE' ? 1 : walkInPlayersCount` forced players to 1 whenever private was selected, overriding multi-player private bookings.
  2. In `calculateWalkInPrice` (lines 283-284), `const players = isPrivate || isExclusiveGame ? 1 : walkInPlayersCount` similarly forced 1 player pricing for any private booking.
  3. Physical Station Status cards completely omitted the explicit booking mode (`Private Session` vs `Shared Session`).

### Part 2: Session Extension Pricing & Models
- **Root Cause of GTA 6 Exclusive pricing (₹150/hr) on all extensions**:
  1. In `ExtendSessionModal.jsx` (lines 17-24), `isExclusive` was defined as `session.bookingType === 'PRIVATE' || session.game?.isExclusive`. Any private session was treated as exclusive, hardcoding ₹150/hr and ignoring standard PS5 rates.
  2. Rates were hardcoded to 150/70 instead of retrieving actual rates from configuration.
  3. `playersCount` was forced to 1 for private sessions instead of charging every billable player (`rate × duration × playersCount`).
  4. In `server/src/utils/pricingCalculator.js` (line 110), `hours = Math.max(1, durationMinutes / 60)` forced a 1-hour minimum charge, causing half-hour (0.5h) extensions to be incorrectly billed as 1 full hour.
  5. In `server/src/services/receptionist.service.js` (line 931), `calculateSessionPrice` was called without `isVenueSelection`, `bookingType`, or pricing snapshot awareness.

### Part 3: Walk-in Customer Search
- **Root Cause of Customer Search Crashing**:
  1. In `server/src/services/receptionist.service.js` (line 252), `mongoose.Types.ObjectId.isValid(cleanQ)` was called, but `import mongoose from 'mongoose';` was completely missing from the file.
  2. Whenever receptionist searched by name, phone, email, or ID, the server threw `500 ReferenceError: mongoose is not defined at searchCustomersForReceptionist`.
  3. The frontend received 500 and rendered "No existing profile found".

---

## 2. Implementation Checklist & Status
- [x] **Part 1: Physical Station Status**
  - [x] 1.1 Remove GTA 6 hardcoding & incorrect `isExclusive` flags from station cards & active table.
  - [x] 1.2 Display actual booking game: actual title, 'Select Game at Venue', or 'Game Not Selected'.
  - [x] 1.3 Add explicit Booking Mode to station card: 'Private Session' or 'Shared Session' with player count.
  - [x] 1.4 Do not infer mode from player count; preserve multi-player private sessions.
- [x] **Part 2: Session Extension**
  - [x] 2.1 Support both Private and Shared/Public session extension without restrictions.
  - [x] 2.2 Remove hardcoded ₹150/₹70 rates; use actual configured pricing rules.
  - [x] 2.3 Calculate extension fee dynamically: `Hourly Rate × Duration × Billable Players` for PS5, table rate for pool, exclusive rate for GTA 6.
  - [x] 2.4 Fix `pricingCalculator.js` to correctly calculate 0.5h (30 min) extensions without forced 1h minimum (`Math.max(0.25, durationMinutes / 60)`).
  - [x] 2.5 Add dedicated extension preview / quote endpoint (`GET /api/receptionist/sessions/:id/preview-extension`).
  - [x] 2.6 Enhance `ExtendSessionModal.jsx` breakdown: Station, Booking ID, Game, Mode, Players, Current End, New End, Duration, Hourly Rate, Calculation, Total Fee, Warnings.
  - [x] 2.7 Concurrency & conflict validation on backend; update booking end time, session status, countdown, and station availability.
- [x] **Part 3: Walk-in Customer Search**
  - [x] 3.1 Added missing `import mongoose from 'mongoose';` in `receptionist.service.js`.
  - [x] 3.2 Implemented flexible digit pattern (`[\s\-]?`) for phone numbers to match partial, national 10-digit, and international formatted numbers.
  - [x] 3.3 Ensure registered and guest customers are found and displayed without duplicates.
  - [x] 3.4 Populate walk-in form on selection and preserve existing walk-in quick register fallback.
- [ ] **Part 4: Testing & Verification**
  - [ ] 4.1 Test Physical Station Status with EA Sports FC 24, GTA 6, venue selection, pool.
  - [ ] 4.2 Test Session Extension across 0.5h, 1h, 1.5h, 2h for Private, Shared, GTA 6, and Pool.
  - [ ] 4.3 Test Walk-in Customer Search with partial names, phone numbers, guest profiles.
  - [x] 4.4 Client build & regression checks (`npm --prefix client run build` passed cleanly).

---

## 3. Files Modified
1. `server/src/services/receptionist.service.js`
   - Added `import mongoose from 'mongoose';`
   - Fixed `getReceptionistDashboardStats` currentSession formatting (gameName, isGTA6, isExclusiveGame, bookingModeDisplay)
   - Enhanced `searchCustomersForReceptionist` with flexible digit regex
   - Enhanced `getActiveSessions` with game displayName, booking mode, isGTA6
   - Added `previewSessionExtension` endpoint handler logic with full conflict checking and formula breakdown
   - Enhanced `extendSession` to allow extending `TIME_EXPIRED` / `AWAITING_RECEPTIONIST` sessions and pass comprehensive options to `calculateSessionPrice`
2. `server/src/utils/pricingCalculator.js`
   - Fixed `Math.max(1, durationMinutes / 60)` to `Math.max(0.25, durationMinutes / 60)` for accurate 0.5h extension calculation
3. `server/src/controllers/receptionist.controller.js`
   - Added `previewExtensionHandler`
4. `server/src/routes/receptionist.routes.js`
   - Registered `GET /sessions/:id/preview-extension`
5. `client/src/api/receptionist.js`
   - Added `previewExtension: (id, durationHours) => apiRequest(...)`
6. `client/src/components/receptionist/ExtendSessionModal.jsx`
   - Upgraded to fetch authoritative dynamic preview from backend
   - Added live breakdown: Game, Booking Mode, Billable Players, Current & New End Times, Calculation Formula, Hourly Rate, Membership discount, and Warnings
7. `client/src/components/receptionist/ReceptionistDashboard.jsx`
   - Fixed `calculateWalkInPrice` to bill all players for multi-player PS5 private sessions
   - Fixed `handleCreateWalkIn` to preserve `walkInPlayersCount` for private sessions
   - Fixed Physical Station Status card to show explicit Booking Mode and remove false GTA 6 lock
   - Fixed Active Sessions table to show actual game title and only show GTA 6 badge on GTA 6 sessions
   - Fixed device selection card to show `₹150/table/hr` for Pool
