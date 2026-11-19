import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';

// Get all users (Admin & Receptionist for customer search)
export const getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit),
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: err.message,
    });
  }
};

// Search single customer by mobile, email, or name (used by Receptionist & Admin for walk-ins/memberships)
export const findCustomerByPhone = async (req, res) => {
  try {
    const rawParam = String(req.params.phone || '').trim();
    if (!rawParam) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required.',
      });
    }

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeRegex = new RegExp(escapeRegex(rawParam), 'i');

    const orConditions = [
      { name: safeRegex },
      { email: safeRegex },
      { customerId: safeRegex },
      { phone: safeRegex },
    ];

    // Normalized phone matching (handles +91, spaces, dashes)
    const digitsOnly = rawParam.replace(/\D/g, '');
    if (digitsOnly.length >= 4) {
      const national10 = digitsOnly.slice(-10);
      const flexibleNational = national10.split('').map((d) => escapeRegex(d)).join('[\\s\\-]?');
      orConditions.push({ phone: new RegExp(flexibleNational, 'i') });
    }

    const customer = await User.findOne({ $or: orConditions })
      .select('-password')
      .populate('membership.planId');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'No customer found matching this query.',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        customer,
        user: customer, // For compatibility with frontend components expecting user or customer
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error searching customer',
      error: err.message,
    });
  }
};

// Update user status or role (Admin only)
export const updateUserRoleOrStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const prevRole = user.role;
    const prevActive = user.isActive;

    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_USER_ROLE_STATUS',
      category: 'AUTH',
      details: {
        targetUserId: user._id,
        targetEmail: user.email,
        from: { role: prevRole, isActive: prevActive },
        to: { role: user.role, isActive: user.isActive },
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: { user: user.toSafeObject() },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: err.message,
    });
  }
};

// Get Activity Logs (Admin only audit trail)
export const getActivityLogs = async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;
    const query = {};
    if (category) query.category = category;

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: { logs },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: err.message,
    });
  }
};
