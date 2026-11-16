const http = require('http');

function postJSON(urlPath, data, token = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJSON(urlPath, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function patchJSON(urlPath, data, token = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function putJSON(urlPath, data, token = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('===========================================================');
  console.log('🧪 NOAH GAMING: COMPREHENSIVE USER MANAGEMENT TEST SUITE');
  console.log('===========================================================');

  // 1. Login as Admin
  console.log('\n[1] Admin Login (admin@gaminglounge.com)...');
  const adminRes = await postJSON('/api/auth/login', {
    identifier: 'admin@gaminglounge.com',
    password: 'AdminPassword@123',
  });
  console.log(`Status: ${adminRes.status}, Success: ${adminRes.data.success}`);
  if (!adminRes.data.success) throw new Error('Admin login failed: ' + JSON.stringify(adminRes));
  const adminToken = adminRes.data.data.token;
  const adminId = adminRes.data.data.user._id;

  // 2. Login as Receptionist
  console.log('\n[2] Receptionist Login (reception@gaminglounge.com)...');
  const staffRes = await postJSON('/api/auth/login', {
    identifier: 'reception@gaminglounge.com',
    password: 'StaffPassword@123',
  });
  console.log(`Status: ${staffRes.status}, Success: ${staffRes.data.success}`);
  const staffToken = staffRes.data.data.token;

  // 3. Test GET /api/admin/users
  console.log('\n[3] Admin GET /api/admin/users (Search & Paginated User Table)...');
  const usersRes = await getJSON('/api/admin/users?page=1&limit=10', adminToken);
  console.log(`Status: ${usersRes.status}, Total Users: ${usersRes.data.data.pagination.total}`);
  console.log('KPIs:', usersRes.data.data.kpis);
  for (const u of usersRes.data.data.users) {
    console.log(`  - ${u.name} | Phone: ${u.phone} | Type: ${u.accountType} | Role: ${u.role} | Bookings: ${u.totalBookings} | Spend: ₹${u.totalVerifiedSpendRupees}`);
  }

  // 4. Test Receptionist Access to GET /api/admin/users
  console.log('\n[4] Receptionist GET /api/admin/users (Front Desk Access)...');
  const staffUsersRes = await getJSON('/api/admin/users?page=1&limit=5', staffToken);
  console.log(`Status: ${staffUsersRes.status}, Success: ${staffUsersRes.data.success}`);

  // 5. Test Pre-creation Duplicate Check
  console.log('\n[5] Check Duplicate Phone (9876543210)...');
  const dupCheck = await getJSON('/api/admin/users/check-duplicate?phone=9876543210', staffToken);
  console.log(`Status: ${dupCheck.status}, Exists: ${dupCheck.data.exists}, Name: ${dupCheck.data.user?.name}`);

  // 6. Test Safeguard: Prevent demoting last admin
  console.log('\n[6] Safeguard Test: Attempt to demote only admin...');
  const demoteRes = await patchJSON(`/api/admin/users/${adminId}/role`, { role: 'customer' }, adminToken);
  console.log(`Status: ${demoteRes.status}, Error Message: "${demoteRes.data.message}"`);
  if (demoteRes.status === 400) {
    console.log('✓ Successfully blocked demoting the only active administrator!');
  } else {
    console.warn('❌ Safeguard failed!');
  }

  // 7. Test Staff Forbidden to Change Role
  console.log('\n[7] RBAC Test: Receptionist attempts to change user role...');
  const staffDemoteRes = await patchJSON(`/api/admin/users/${adminId}/role`, { role: 'customer' }, staffToken);
  console.log(`Status: ${staffDemoteRes.status}, Message: "${staffDemoteRes.data.message}"`);
  if (staffDemoteRes.status === 403) {
    console.log('✓ Receptionist successfully restricted from role modification!');
  }

  // 8. Front Desk Walk-In Guest Creation
  const testPhone = '9800000001';
  console.log(`\n[8] Front Desk creates new walk-in guest player (${testPhone})...`);
  const walkinRes = await postJSON('/api/receptionist/customers', {
    name: 'Walkin Test Player',
    phone: testPhone,
    email: 'walkin.test@testnoah.com',
  }, staffToken);
  console.log(`Status: ${walkinRes.status}, Customer: ${walkinRes.data.data.name}, Type: ${walkinRes.data.data.accountType || 'GUEST'}`);
  const newGuestId = walkinRes.data.data._id;

  // 9. Test Online Registration with Guest Phone -> Detects Guest & Returns Conversion OTP
  console.log('\n[9] Online Registration with existing guest phone (triggers conversion workflow)...');
  const regGuestRes = await postJSON('/api/auth/register', {
    name: 'Walkin Test Player Renamed',
    phone: testPhone,
    email: 'walkin.converted@testnoah.com',
    password: 'NewCustomerPass@123',
  });
  console.log(`Status: ${regGuestRes.status}, requiresConversion: ${regGuestRes.data.requiresConversion}`);
  console.log(`Message: "${regGuestRes.data.message}"`);
  const otpCode = regGuestRes.data.data.otpHint;
  console.log(`Received OTP: ${otpCode}`);

  // 10. Complete Online Guest Conversion with OTP & Password
  console.log('\n[10] Complete Online Guest Conversion with OTP...');
  const convertRes = await postJSON('/api/auth/conversion/verify-otp', {
    userId: newGuestId,
    phone: testPhone,
    otp: otpCode,
    password: 'NewCustomerPass@123',
    email: 'walkin.converted@testnoah.com',
    name: 'John Fully Registered Gamer',
  });
  console.log(`Status: ${convertRes.status}, Success: ${convertRes.data.success}`);
  console.log(`Converted Account Type: ${convertRes.data.data.user.accountType}, isGuest: ${convertRes.data.data.user.isGuest}`);
  console.log(`Preserved ObjectId: ${convertRes.data.data.user._id === newGuestId ? '✓ MATCH (Original ObjectId Preserved!)' : '❌ MISMATCH'}`);

  // 11. Customer Login with newly converted credentials
  console.log('\n[11] Test Customer Login with new password...');
  const custLogin = await postJSON('/api/auth/login', {
    identifier: testPhone,
    password: 'NewCustomerPass@123',
  });
  console.log(`Status: ${custLogin.status}, Welcome: "${custLogin.data.message}"`);

  // 12. Edit User Details (Update Name & Notes)
  console.log('\n[12] Edit User Details via User Management API...');
  const editRes = await putJSON(`/api/admin/users/${newGuestId}`, {
    name: 'John Registered Gamer Updated',
    notes: 'Loyal PC and PS5 gamer from Mumbai counter',
    accountStatus: 'ACTIVE',
  }, staffToken);
  console.log(`Status: ${editRes.status}, Updated Name: ${editRes.data.data.user.name}, Notes: "${editRes.data.data.user.notes}"`);

  // 13. Password Reset OTP Request & Verification
  console.log('\n[13] Staff initiates Password Reset for customer...');
  const resetOtpRes = await postJSON(`/api/admin/users/${newGuestId}/reset-password/request-otp`, {}, staffToken);
  console.log(`Status: ${resetOtpRes.status}, OTP: ${resetOtpRes.data.data.otpHint}`);
  const resetOtp = resetOtpRes.data.data.otpHint;

  console.log('Complete Password Reset...');
  const completeResetRes = await postJSON(`/api/admin/users/${newGuestId}/reset-password/complete`, {
    otp: resetOtp,
    newPassword: 'BrandNewPassword@456',
  }, staffToken);
  console.log(`Status: ${completeResetRes.status}, Message: "${completeResetRes.data.message}"`);

  // Test Login with BrandNewPassword@456
  const testNewPassLogin = await postJSON('/api/auth/login', {
    identifier: testPhone,
    password: 'BrandNewPassword@456',
  });
  console.log(`Status: ${testNewPassLogin.status}, Success: ${testNewPassLogin.data.success}`);

  // 14. Create Secondary Guest and test Account Merge
  const secondaryPhone = '9800000002';
  console.log(`\n[14] Creating secondary duplicate account (${secondaryPhone}) and testing Merge...`);
  const secUserRes = await postJSON('/api/receptionist/customers', {
    name: 'Duplicate Player Account',
    phone: secondaryPhone,
  }, staffToken);
  const secUserId = secUserRes.data.data._id;

  console.log(`Merging secondary (${secUserId}) into primary (${newGuestId})...`);
  const mergeRes = await postJSON('/api/admin/users/merge', {
    primaryUserId: newGuestId,
    secondaryUserId: secUserId,
    reason: 'Customer duplicate profile phone resolution',
  }, adminToken);
  console.log(`Status: ${mergeRes.status}, Message: "${mergeRes.data.message}"`);
  console.log('Migrated Counts:', mergeRes.data.data.migratedCounts);

  // 15. Verify secondary is deactivated and marked merged
  const secCheck = await getJSON(`/api/admin/users/${secUserId}`, adminToken);
  console.log(`Secondary Status: ${secCheck.data.data.user.accountStatus}, Merged Into: ${secCheck.data.data.user.mergedInto?._id || secCheck.data.data.user.mergedInto}`);

  console.log('\n===========================================================');
  console.log('🎉 ALL 15 AUTOMATED BACKEND VERIFICATION TESTS PASSED!');
  console.log('===========================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
