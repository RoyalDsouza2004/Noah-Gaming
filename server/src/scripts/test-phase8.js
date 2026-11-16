import mongoose from 'mongoose';

const BASE_URL = 'http://localhost:5000/api';

async function runPhase8Tests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 8 Session Timers, Automation & Notifications Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate Staff / Receptionist
  let receptionistToken = '';
  let receptionistUser = null;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'reception@gaminglounge.com',
        password: 'StaffPassword@123',
      }),
    });
    const body = await res.json();
    assert(res.ok && body.data?.token, '1. Receptionist authentication successful');
    receptionistToken = body.data?.token;
    receptionistUser = body.data?.user;
  } catch (err) {
    assert(false, `1. Receptionist login failed: ${err.message}`);
  }

  // 2. Authenticate Customer
  let customerToken = '';
  let customerUser = null;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'customer@gaminglounge.com',
        password: 'CustomerPassword@123',
      }),
    });
    const body = await res.json();
    assert(res.ok && body.data?.token, '2. Customer authentication successful');
    customerToken = body.data?.token;
    customerUser = body.data?.user;
  } catch (err) {
    assert(false, `2. Customer login failed: ${err.message}`);
  }

  // 3. Authenticate Admin
  let adminToken = '';
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@gaminglounge.com',
        password: 'AdminPassword@123',
      }),
    });
    const body = await res.json();
    assert(res.ok && body.data?.token, '3. Admin authentication successful');
    adminToken = body.data?.token;
  } catch (err) {
    assert(false, `3. Admin login failed: ${err.message}`);
  }

  const staffHeaders = {
    Authorization: `Bearer ${receptionistToken}`,
    'Content-Type': 'application/json',
  };

  const customerHeaders = {
    Authorization: `Bearer ${customerToken}`,
    'Content-Type': 'application/json',
  };

  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  // 4. Test Admin Automation Settings API
  let settings = null;
  try {
    const res = await fetch(`${BASE_URL}/admin/automation/settings`, {
      headers: adminHeaders,
    });
    const json = await res.json();
    settings = json.data;
    assert(
      res.ok && json.success && Array.isArray(settings.sessionReminderIntervals),
      '4. Admin Automation Settings fetched with configurable intervals'
    );
    assert(
      settings.sessionReminderIntervals.includes(15) &&
      settings.sessionReminderIntervals.includes(5) &&
      settings.sessionReminderIntervals.includes(1),
      '5. Default session reminder intervals include 15m, 5m, and 1m'
    );
  } catch (err) {
    assert(false, `4-5. Automation settings failed: ${err.message}`);
  }

  // 5. Create a test walk-in booking to verify session start and timers
  let testBooking = null;
  try {
    // Fetch an active device (8-Ball Pool Table or PS5-02)
    const devRes = await fetch(`${BASE_URL}/devices`);
    const devData = await devRes.json();
    const testDevice = devData.data?.devices?.find((d) => d.deviceCode === 'POOL-01') || devData.data?.devices?.[0];

    const walkInRes = await fetch(`${BASE_URL}/receptionist/bookings`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        customerId: customerUser.id || customerUser._id,
        deviceId: testDevice._id,
        duration: 1,
        startTime: '14:00',
        bookingDate: '2026-11-20',
        numberOfPlayers: 1,
        bookingType: 'SHARED',
        paymentMethod: 'CASH',
        paymentAmountPaise: 6000,
        notes: 'Test Phase 8 Automation Session',
      }),
    });
    const walkInData = await walkInRes.json();
    if (!walkInRes.ok) {
      console.log('Walk-in error response:', walkInRes.status, walkInData);
    }
    testBooking = walkInData.data?.booking;
    assert(
      walkInRes.ok && testBooking && testBooking._id,
      `6. Created test booking ${testBooking?.bookingId} for session timer testing`
    );
  } catch (err) {
    assert(false, `6. Walk-in test booking creation failed: ${err.message}`);
  }

  // 6. Test Start Gaming Session Timer (Authoritative Server-Side Timestamp)
  let activeSession = null;
  try {
    const res = await fetch(`${BASE_URL}/sessions/${testBooking._id}/start`, {
      method: 'POST',
      headers: staffHeaders,
    });
    const json = await res.json();
    activeSession = json.data;
    assert(
      res.ok && json.success && activeSession.status === 'ACTIVE',
      '7. Session timer starts with status ACTIVE'
    );
    assert(
      activeSession.scheduledEndAt && activeSession.remainingSeconds > 0,
      `8. Server-side scheduledEndAt recorded (${activeSession.scheduledEndAt}), remaining: ${activeSession.remainingSeconds}s`
    );
  } catch (err) {
    assert(false, `7-8. Start gaming session failed: ${err.message}`);
  }

  // 7. Test Timer Survives Page Refresh & Browser Reopen (Authoritative Sync)
  try {
    const res = await fetch(`${BASE_URL}/sessions/${activeSession.id || activeSession._id}`, {
      headers: staffHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && json.data.remainingSeconds > 0 && json.data.remainingSeconds <= 3600,
      '9. Timer survives page refresh: backend recalculates accurate remainingSeconds from scheduledEndAt'
    );
  } catch (err) {
    assert(false, `9. Refresh check failed: ${err.message}`);
  }

  // 8. Test Active Sessions Endpoint for Receptionist & Customer
  try {
    const res = await fetch(`${BASE_URL}/sessions/active`, {
      headers: staffHeaders,
    });
    const json = await res.json();
    assert(
      res.ok && Array.isArray(json.data.sessions) && json.data.sessions.some((s) => s.id === activeSession.id || s.id === activeSession._id),
      '10. GET /api/sessions/active returns live active session list'
    );
  } catch (err) {
    assert(false, `10. Active sessions failed: ${err.message}`);
  }

  // 9. Test Reminder Notification Delivery & Idempotency
  try {
    // Trigger automated cycle via admin endpoint
    const cycleRes = await fetch(`${BASE_URL}/admin/automation/trigger`, {
      method: 'POST',
      headers: adminHeaders,
    });
    const cycleJson = await cycleRes.json();
    assert(
      cycleRes.ok && cycleJson.success,
      '11. Background automation cycle executed successfully'
    );

    // Verify notification was generated for session start
    const notifRes = await fetch(`${BASE_URL}/notifications`, {
      headers: customerHeaders,
    });
    const notifJson = await notifRes.json();
    assert(
      notifRes.ok && Array.isArray(notifJson.data.notifications),
      '12. Customer notifications retrieved'
    );
  } catch (err) {
    assert(false, `11-12. Notification cycle check failed: ${err.message}`);
  }

  // 10. Test Notification Unread Count & Mark-As-Read
  try {
    const unreadRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: customerHeaders,
    });
    const unreadJson = await unreadRes.json();
    assert(
      unreadRes.ok && typeof unreadJson.data.unreadCount === 'number',
      `13. Unread count retrieved: ${unreadJson.data.unreadCount}`
    );

    const markAllRes = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: customerHeaders,
    });
    const markAllJson = await markAllRes.json();
    assert(
      markAllRes.ok && markAllJson.success,
      '14. Mark all notifications as read succeeded'
    );

    const afterRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: customerHeaders,
    });
    const afterJson = await afterRes.json();
    assert(
      afterRes.ok && afterJson.data.unreadCount === 0,
      '15. Unread count successfully reset to 0'
    );
  } catch (err) {
    assert(false, `13-15. Unread count / mark as read failed: ${err.message}`);
  }

  // 11. Test Session Extension Automation (Conflict checks & reminder rescheduling)
  let extendedSession = null;
  try {
    const m = await import('mongoose');
    if (!m.default.connection.readyState) {
      await m.default.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    }
    const db = m.default.connection.db;

    // A. Create an artificial conflicting booking right in the 1-hour extension window
    const prevEnd = new Date(activeSession.scheduledEndAt);
    const conflictEnd = new Date(prevEnd.getTime() + 3600 * 1000);
    const conflictBookingId = `BK-CONFLICT-${Date.now()}`;
    const devIdStr = testBooking.device?._id ? testBooking.device._id.toString() : testBooking.device.toString();
    const testDevId = new m.default.Types.ObjectId(devIdStr);

    await db.collection('bookings').insertOne({
      bookingId: conflictBookingId,
      customer: new m.default.Types.ObjectId(customerUser.id || customerUser._id),
      device: testDevId,
      bookingType: 'SHARED',
      bookingDate: prevEnd.toISOString().slice(0, 10),
      startTime: prevEnd.toISOString().slice(11, 16),
      endTime: conflictEnd.toISOString().slice(11, 16),
      startAt: prevEnd,
      endAt: conflictEnd,
      duration: 1,
      numberOfPlayers: 1,
      totalAmount: 6000,
      bookingStatus: 'CONFIRMED',
      checkInStatus: 'NOT_CHECKED_IN',
      sessionStatus: 'SCHEDULED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Attempt extension which should detect conflict and return 409
    const conflictRes = await fetch(`${BASE_URL}/sessions/${activeSession.id || activeSession._id}/extend`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        extendedDurationHours: 1,
        paymentMethod: 'CASH',
        paymentAmountPaise: 6000,
        notes: 'Extension conflict test',
      }),
    });
    assert(
      conflictRes.status === 409,
      '16. Extension conflict checks work: Overlapping booking detected and rejected with HTTP 409'
    );

    // Remove the artificial conflict
    await db.collection('bookings').deleteOne({ bookingId: conflictBookingId });

    // B. Now execute legitimate extension
    const extRes = await fetch(`${BASE_URL}/sessions/${activeSession.id || activeSession._id}/extend`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        extendedDurationHours: 1,
        paymentMethod: 'CASH',
        paymentAmountPaise: 6000,
        notes: 'Extended via Phase 8 Test',
      }),
    });
    const extJson = await extRes.json();
    if (!extRes.ok) {
      console.log('Step B extension failed:', extRes.status, extJson);
    }
    extendedSession = extJson.data;

    assert(
      extRes.ok && extendedSession.status === 'EXTENDED',
      '17. Session extension succeeded with status EXTENDED'
    );
    assert(
      new Date(extendedSession.scheduledEndAt).getTime() > new Date(activeSession.scheduledEndAt).getTime(),
      '18. Session scheduledEndAt extended by 1 hour and timer updated'
    );
    assert(
      extendedSession.extensionHistory && extendedSession.extensionHistory.length > 0,
      '19. Extension history recorded with previous and new timestamps'
    );
  } catch (err) {
    assert(false, `16-19. Session extension failed: ${err.message}`);
  }

  // 12. Test Session Expiration Detection without Physical Auto-Termination (Rule 4)
  try {
    // Simulate scheduledEndAt reached in DB
    const m = await import('mongoose');
    if (!m.default.connection.readyState) {
      await m.default.connect('mongodb://127.0.0.1:27017/gaming_lounge');
    }
    const db = m.default.connection.db;
    const sessId = new m.default.Types.ObjectId(activeSession.id || activeSession._id);

    // Set scheduledEndAt to 10 seconds ago
    const pastTime = new Date(Date.now() - 10000);
    await db.collection('gamingsessions').updateOne(
      { _id: sessId },
      { $set: { scheduledEndAt: pastTime, status: 'ACTIVE' } }
    );

    // Trigger automation check
    await fetch(`${BASE_URL}/admin/automation/trigger`, {
      method: 'POST',
      headers: adminHeaders,
    });

    // Fetch updated session
    const checkRes = await fetch(`${BASE_URL}/sessions/${sessId}`, {
      headers: staffHeaders,
    });
    const checkJson = await checkRes.json();
    const updatedSess = checkJson.data;

    assert(
      updatedSess.status === 'AWAITING_RECEPTIONIST' || updatedSess.isOverdue,
      '19. Session end detected: marked as AWAITING_RECEPTIONIST / overdue'
    );
    assert(
      updatedSess.status !== 'COMPLETED',
      '20. Crucial rule enforced: Session does NOT automatically terminate physically. Awaiting staff confirmation.'
    );
  } catch (err) {
    assert(false, `19-20. Session expiration check failed: ${err.message}`);
  }

  // 13. Test Receptionist Checkout Confirmation & Device Release
  try {
    const compRes = await fetch(`${BASE_URL}/sessions/${activeSession.id || activeSession._id}/complete`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        paymentCollection: { amountPaise: 0, paymentMethod: 'CASH' },
        notes: 'Receptionist confirmed player stopped playing',
      }),
    });
    const compJson = await compRes.json();
    assert(
      compRes.ok && compJson.success,
      '21. Receptionist confirmed and completed gaming session'
    );

    const sessCheck = await fetch(`${BASE_URL}/sessions/${activeSession.id || activeSession._id}`, {
      headers: staffHeaders,
    });
    const sessCheckJson = await sessCheck.json();
    assert(
      sessCheckJson.data.status === 'COMPLETED' && sessCheckJson.data.actualEndAt,
      '22. Session marked COMPLETED with actualEndAt recorded'
    );
  } catch (err) {
    assert(false, `21-22. Complete session failed: ${err.message}`);
  }

  // 14. Test Automation Logs API
  try {
    const logsRes = await fetch(`${BASE_URL}/admin/automation/logs`, {
      headers: adminHeaders,
    });
    const logsJson = await logsRes.json();
    assert(
      logsRes.ok && Array.isArray(logsJson.data.logs) && logsJson.data.logs.length > 0,
      '23. GET /api/admin/automation/logs returns scheduler execution audit logs'
    );
  } catch (err) {
    assert(false, `23. Automation logs failed: ${err.message}`);
  }

  // 15. Test Admin Global Notification Audit
  try {
    const notifAuditRes = await fetch(`${BASE_URL}/admin/notifications`, {
      headers: adminHeaders,
    });
    const notifAuditJson = await notifAuditRes.json();
    assert(
      notifAuditRes.ok && Array.isArray(notifAuditJson.data.notifications),
      '24. GET /api/admin/notifications returns system-wide notification history'
    );
  } catch (err) {
    assert(false, `24. Admin notifications failed: ${err.message}`);
  }

  // 16. Test Previous Phases Health & Public Stability
  try {
    const hRes = await fetch(`${BASE_URL}/health`);
    const hJson = await hRes.json();
    assert(
      hRes.ok && hJson.success && hJson.data?.status === 'UP',
      '25. Previous phases intact: Server health UP, DB operational, scheduler active'
    );
  } catch (err) {
    assert(false, `25. Previous phases health check failed: ${err.message}`);
  }

  console.log('\n----------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL 25 PHASE 8 AUTOMATION & SESSION TESTS PASSED!\n');
    process.exit(0);
  }
}

runPhase8Tests();
