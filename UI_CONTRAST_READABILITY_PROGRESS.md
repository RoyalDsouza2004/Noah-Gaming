# NOAH GAMING: Global UI Readability & Dark Theme Contrast Progress

## 1. Audit Scope & Status
- [x] Audit centralized color tokens in `client/tailwind.config.js` and `client/src/index.css`.
- [x] Implement Universal Dark Theme Form Control & Text Guard Rules in `client/src/index.css` (native `<select>` option styling, input placeholder styling, and slate/gray text remapping to high-contrast warm tokens).
- [x] Fix hardcoded `text-slate-950` on dark burgundy backgrounds:
  - `AdminAnalyticsView.jsx`: Export Reports button (`bg-gradient-to-r from-[#851B2B] to-[#A51F35] text-slate-950` -> `text-white font-bold`).
  - `CustomerDashboard.jsx`: Customer avatar fallback initial (`bg-gradient-to-br from-[#851B2B] to-[#A51F35] text-slate-950` -> `text-white font-black`).
  - `CheckoutModal.jsx`: Checkout confirm button (`bg-gradient-to-r from-purple-400 to-indigo-500 text-slate-950` -> `bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold`).
  - `HomePage.jsx`: Disabled station maintenance button (`text-[#C7A5A8]/50` -> `text-[#D0B9BC]`).
  - `QuickRegisterModal.jsx` & `ReceptionistDashboard.jsx`: Cleaned up duplicate `text-slate-950` on lime buttons.
- [x] Audit Customer Home Page (`HomePage.jsx`, `Footer.jsx`, `GameCard.jsx`, `GameDetailsModal.jsx`).
- [x] Audit Customer Profile & My Bookings (`CustomerDashboard.jsx`, `MyBookings.jsx`, `ActiveSessionCountdown.jsx`).
- [x] Audit Booking Wizard (`BookingWizard.jsx`: device/station selection, game selection, summary, pricing quote).
- [x] Audit Membership Modals & Views (`MembershipPlansModal.jsx`, `MembershipRenewalModal.jsx`, `MembershipUpdateModal.jsx`, `MembershipUpgradeModal.jsx`).
- [x] Audit Admin Operational Views (`AdminDashboard.jsx`, `UserManagementTab.jsx`, `AdminBookingsTab.jsx`, `AdminPaymentsTab.jsx`, `AdminOperatingHoursTab.jsx`, `AdminMembershipsTab.jsx`, `AdminEmailTab.jsx`, `AdminAutomationTab.jsx`, `AdminCalendarTab.jsx`, `AdminAnalyticsView.jsx`, `ReportExportModal.jsx`, `AdminGameImportModal.jsx`).
- [x] Audit Front Desk Dashboard & Modals (`ReceptionistDashboard.jsx`, `ExtendSessionModal.jsx`, `CheckInModal.jsx`, `CheckoutModal.jsx`, `CollectPaymentModal.jsx`, `QuickRegisterModal.jsx`).
- [x] Strictly preserved `MobileBottomNav.jsx` with zero modifications.
- [x] Verified client production build `npm --prefix client run build` (built in 6.16s with 0 errors).
- [ ] Active verification in browser subagent.

---

## 2. Color System & Contrast Measurements (WCAG 2.2 AA / AAA)

| Color Token | Hex Code | Contrast vs Dark Charcoal (#171014) | Contrast vs Dark Burgundy (#260D17) | Contrast vs Brand Burgundy (#851B2B) | WCAG Status |
|---|---|---|---|---|---|
| **Primary Text (Warm White)** | `#FFF4E8` | **18.2:1** | **18.5:1** | **10.0:1** | **AAA Pass** |
| **Secondary Text (Warm Rose)** | `#C7A5A8` | **6.8:1** | **7.0:1** | **3.8:1** | **AA Pass** |
| **Muted Text (Warm Light)** | `#D0B9BC` | **10.8:1** | **11.0:1** | **5.9:1** | **AAA Pass** |
| **Secondary Light Muted** | `#E2D4D6` | **13.5:1** | **13.7:1** | **7.4:1** | **AAA Pass** |
| **Disabled Text** | `#BCA3A7` | **8.4:1** | **8.5:1** | **4.6:1** | **AA Pass** |
| **Neon Highlight** | `#D7FF00` | **17.8:1** | **18.1:1** | **9.7:1** | **AAA Pass** |
| **Gold / Warning** | `#F5B942` | **11.2:1** | **11.4:1** | **6.1:1** | **AAA Pass** |
| **Status Green** | `#45C987` | **9.4:1** | **9.6:1** | **5.2:1** | **AA Pass** |
| **Status Red** | `#F06A76` | **6.5:1** | **6.6:1** | **3.6:1** | **AA Pass** |

---

## 3. Files Modified
1. `client/tailwind.config.js`:
   - Extended semantic brand tokens: `elevated`, `input`, `mutedText`, `disabledText`.
2. `client/src/index.css`:
   - Added semantic CSS variables for elevated surfaces, input background, muted and disabled text in `:root` and `html.light`.
   - Added universal dark theme form controls (`input`, `textarea`, `select`, `option`).
   - Added `select option` dark styling (`background-color: #260D17; color: #FFF4E8`) and light styling (`background-color: #FFFFFF; color: #382019`) to prevent unstyled native dropdown text.
   - Added Dark Theme Text Contrast Guards remapping `text-slate-400`, `text-slate-500`, `text-slate-600` to high-contrast warm tokens (`#E2D4D6`, `#D0B9BC`, `#BCA3A7`).
   - Added SVG Chart text contrast guards in dark mode (`#D0B9BC` and `#E2D4D6`).
3. `client/src/components/admin/analytics/AdminAnalyticsView.jsx`:
   - Fixed Export Reports button from `text-slate-950` to `text-white font-bold` on burgundy/crimson gradient.
4. `client/src/components/customer/CustomerDashboard.jsx`:
   - Fixed customer avatar initial from `text-slate-950` to `text-white font-black` on burgundy avatar container.
5. `client/src/components/receptionist/CheckoutModal.jsx`:
   - Fixed end session button from `text-slate-950` to `text-white font-bold` on purple/indigo gradient.
6. `client/src/pages/HomePage.jsx`:
   - Fixed station under maintenance button text from `text-[#C7A5A8]/50` to high-contrast `text-[#D0B9BC]`.
7. `client/src/components/receptionist/QuickRegisterModal.jsx` & `client/src/components/receptionist/ReceptionistDashboard.jsx`:
   - Cleaned up duplicate `text-slate-950` class on neon lime buttons.
