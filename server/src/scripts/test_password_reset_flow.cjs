/**
 * Integration Test Script: Forgot Password, Email OTP, Production Reset Links & Profile Password Reset
 */
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');

async function run() {
  console.log('--- 1. Testing URL and Email Masking Utilities ---');
  const { getFrontendUrl, getPasswordResetUrl } = await import('../utils/url.js');
  const { maskEmail } = await import('../controllers/auth.controller.js');

  const frontendUrl = getFrontendUrl();
  console.log('getFrontendUrl():', frontendUrl);
  if (!frontendUrl || frontendUrl.includes('undefined')) {
    throw new Error('getFrontendUrl() returned invalid URL: ' + frontendUrl);
  }

  const dummyToken = 'a1b2c3d4e5f6';
  const resetUrl = getPasswordResetUrl(dummyToken);
  console.log('getPasswordResetUrl():', resetUrl);
  if (!resetUrl.includes('#reset-password?token=a1b2c3d4e5f6')) {
    throw new Error('getPasswordResetUrl() did not include valid reset path: ' + resetUrl);
  }

  const testMask1 = maskEmail('r@gmail.com');
  const testMask2 = maskEmail('ro@yahoo.com');
  const testMask3 = maskEmail('roy@example.com');
  const testMask4 = maskEmail('royal@example.com');
  console.log('maskEmail tests:', { testMask1, testMask2, testMask3, testMask4 });

  if (!testMask2.startsWith('r***') && !testMask2.startsWith('ro***')) {
    throw new Error('maskEmail failed for ro@yahoo.com: ' + testMask2);
  }
  if (!testMask3.startsWith('ro***')) {
    throw new Error('maskEmail failed for roy@example.com: ' + testMask3);
  }

  console.log('✓ URL and Masking verified successfully!\n');

  console.log('--- 2. Connecting to MongoDB for End-to-End Auth Testing ---');
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn('MONGODB_URI not found in environment, skipping live DB test');
    return;
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas');

  const User = (await import('../models/User.js')).default;
  const OtpVerification = (await import('../models/OtpVerification.js')).default;
  const { ROLES } = await import('../config/constants.js');
  const { forgotPasswordRequestOtp, forgotPasswordVerifyOtp } = await import('../controllers/auth.controller.js');

  // Find or create a test customer
  const testEmail = 'test_reset_customer@example.com';
  const testPhone = '9876599999';
  let testUser = await User.findOne({ email: testEmail });
  if (!testUser) {
    testUser = await User.create({
      name: 'Test Reset Customer',
      email: testEmail,
      phone: testPhone,
      password: 'OldPassword123!',
      role: ROLES.CUSTOMER,
    });
    console.log('Created test user:', testUser.email);
  } else {
    testUser.phone = testPhone;
    testUser.role = ROLES.CUSTOMER;
    testUser.password = 'OldPassword123!';
    await testUser.save();
    console.log('Using existing test user:', testUser.email);
  }

  // Clear prior test OTPs for this user
  await OtpVerification.deleteMany({ userId: testUser._id });

  // Test A: Request OTP using EMAIL
  console.log('\n--- 3. Testing Forgot Password OTP Request via EMAIL ---');
  let mockReq = { body: { identifier: testEmail }, ip: '127.0.0.1' };
  let resStatus = null;
  let resData = null;
  let mockRes = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resData = data;
      return this;
    },
  };

  await forgotPasswordRequestOtp(mockReq, mockRes);
  console.log('Response Status:', resStatus);
  console.log('Response Message:', resData?.message);
  console.log('Response Data:', resData?.data);

  if (resStatus !== 200 || !resData?.success) {
    throw new Error('Failed to request OTP via email: ' + JSON.stringify(resData));
  }
  if (!resData.data?.maskedEmail) {
    throw new Error('Masked email missing from response data');
  }
  if (resData.data?.phone || resData.data?.maskedPhone) {
    throw new Error('Phone number must not be exposed in OTP response data');
  }
  console.log('✓ Email request returned masked destination:', resData.data.maskedEmail);

  // Test B: Verify OTP was created in DB for PASSWORD_RESET purpose
  const createdOtp = await OtpVerification.findOne({
    userId: testUser._id,
    purpose: 'PASSWORD_RESET',
    used: false,
  }).select('+otpHash');

  if (!createdOtp) {
    throw new Error('No OtpVerification record found in DB for PASSWORD_RESET');
  }
  console.log('✓ Found OtpVerification record with purpose:', createdOtp.purpose);

  // Test C: Request OTP using MOBILE NUMBER (Scenario B)
  console.log('\n--- 4. Testing Forgot Password OTP Request via MOBILE NUMBER ---');
  // Wait cooldown bypass by resetting resendAvailableAt in test
  createdOtp.resendAvailableAt = new Date(Date.now() - 10000);
  await createdOtp.save();

  mockReq = { body: { identifier: testPhone }, ip: '127.0.0.1' };
  await forgotPasswordRequestOtp(mockReq, mockRes);
  console.log('Response Status:', resStatus);
  console.log('Response Message:', resData?.message);
  console.log('Response Data:', resData?.data);

  if (resStatus !== 200 || !resData?.success) {
    throw new Error('Failed to request OTP via phone: ' + JSON.stringify(resData));
  }
  if (resData.message.includes(testPhone)) {
    throw new Error('Response message must not state OTP was sent to phone: ' + resData.message);
  }
  if (resData.data?.phone || resData.data?.maskedPhone) {
    throw new Error('Phone number must not be exposed in OTP response data');
  }
  console.log('✓ Mobile number search identified account and returned masked email:', resData.data.maskedEmail);

  // Test D: Step 2 & 3 - Multi-step OTP Verification & Password Reset
  console.log('\n--- 5. Testing Multi-Step OTP Verification and Password Reset ---');
  const latestOtpRecord = await OtpVerification.findOne({
    userId: testUser._id,
    purpose: 'PASSWORD_RESET',
    used: false,
  }).select('+otpHash');

  // Inject known OTP hash for testing
  const testOtpCode = '654321';
  latestOtpRecord.otpHash = OtpVerification.hashOtp(testOtpCode);
  await latestOtpRecord.save();

  // Step 2: Verify OTP code alone
  mockReq = { body: { identifier: testPhone, otp: testOtpCode }, ip: '127.0.0.1' };
  await forgotPasswordVerifyOtp(mockReq, mockRes);
  console.log('Step 2 Verify Status:', resStatus);
  console.log('Step 2 Verify Data:', resData);

  if (resStatus !== 200 || !resData?.success || !resData?.data?.resetToken) {
    throw new Error('Step 2 OTP verification failed: ' + JSON.stringify(resData));
  }
  const resetToken = resData.data.resetToken;
  console.log('✓ Step 2 verified code and issued resetToken');

  // Step 3: Set new password with resetToken
  const newSecretPassword = 'BrandNewPassword2026!';
  mockReq = {
    body: {
      identifier: testPhone,
      resetToken,
      newPassword: newSecretPassword,
    },
    ip: '127.0.0.1',
  };
  await forgotPasswordVerifyOtp(mockReq, mockRes);
  console.log('Step 3 Reset Status:', resStatus);
  console.log('Step 3 Reset Data:', resData);

  if (resStatus !== 200 || !resData?.success) {
    throw new Error('Step 3 password update failed: ' + JSON.stringify(resData));
  }

  // Verify User password was actually updated and hashed with bcrypt
  const updatedUser = await User.findById(testUser._id).select('+password');
  const isMatch = await updatedUser.comparePassword(newSecretPassword);
  if (!isMatch) {
    throw new Error('User password was not updated correctly in database');
  }
  console.log('✓ User password in database verified against new password hash!');

  // Verify challenge was consumed
  const consumedOtp = await OtpVerification.findById(latestOtpRecord._id);
  if (!consumedOtp.used || consumedOtp.status !== 'CONSUMED') {
    throw new Error('OTP record was not marked consumed');
  }
  console.log('✓ OTP record successfully marked consumed');

  // Clean up test user
  await OtpVerification.deleteMany({ userId: testUser._id });
  await User.deleteOne({ _id: testUser._id });
  console.log('\n✓ Cleaned up test user and OTP records');

  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log(' ALL FORGOT PASSWORD & OTP VERIFICATION TESTS PASSED! ');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
