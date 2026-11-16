import Device from '../models/Device.js';
import DeviceMaintenance from '../models/DeviceMaintenance.js';
import Pricing from '../models/Pricing.js';
import ActivityLog from '../models/ActivityLog.js';

export const getAllDevices = async (req, res) => {
  try {
    const { status, deviceType, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (deviceType) filter.deviceType = deviceType;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { deviceCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const devices = await Device.find(filter)
      .populate('supportedGames', 'name category thumbnail isExclusive status')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: { devices, total: devices.length },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve devices',
      error: err.message,
    });
  }
};

export const getDeviceById = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id).populate(
      'supportedGames',
      'name description thumbnail category isExclusive status'
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    // Get active pricing rule if any
    const pricing = await Pricing.findOne({
      $or: [{ device: device._id }, { deviceType: device.deviceType }],
      status: 'ACTIVE',
    });

    res.status(200).json({
      success: true,
      data: { device, pricing },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching device',
      error: err.message,
    });
  }
};

export const createDevice = async (req, res) => {
  try {
    const {
      name,
      deviceCode,
      deviceType = 'PS5',
      description,
      image,
      capacity = 4,
      supportedGames = [],
      status = 'ACTIVE',
    } = req.body;

    const existingCode = await Device.findOne({ deviceCode: deviceCode.trim().toUpperCase() });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: `A device with code '${deviceCode.toUpperCase()}' already exists.`,
      });
    }

    const device = new Device({
      name: name.trim(),
      deviceCode: deviceCode.trim().toUpperCase(),
      deviceType,
      description: description ? description.trim() : '',
      image: image ? image.trim() : '',
      capacity: parseInt(capacity),
      supportedGames,
      status,
    });

    await device.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE_DEVICE',
      category: 'DEVICE',
      details: { deviceId: device._id, name: device.name, code: device.deviceCode, capacity: device.capacity },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Device '${device.name}' registered successfully.`,
      data: { device },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to create device',
      error: err.message,
    });
  }
};

export const updateDevice = async (req, res) => {
  try {
    const { name, deviceCode, deviceType, description, image, capacity, supportedGames, status } = req.body;
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    if (deviceCode && deviceCode.trim().toUpperCase() !== device.deviceCode) {
      const duplicate = await Device.findOne({
        deviceCode: deviceCode.trim().toUpperCase(),
        _id: { $ne: device._id },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Device code '${deviceCode.toUpperCase()}' is already used by another device.`,
        });
      }
      device.deviceCode = deviceCode.trim().toUpperCase();
    }

    if (name) device.name = name.trim();
    if (deviceType) device.deviceType = deviceType;
    if (typeof description === 'string') device.description = description.trim();
    if (typeof image === 'string') device.image = image.trim();
    if (capacity !== undefined) device.capacity = parseInt(capacity);
    if (Array.isArray(supportedGames)) device.supportedGames = supportedGames;
    if (status) device.status = status;

    await device.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_DEVICE',
      category: 'DEVICE',
      details: { deviceId: device._id, name: device.name, status: device.status, capacity: device.capacity },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Device '${device.name}' updated successfully.`,
      data: { device },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update device',
      error: err.message,
    });
  }
};

export const deleteDevice = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    // Check dependent records in Maintenance
    const maintenanceRecords = await DeviceMaintenance.countDocuments({ device: device._id });
    if (maintenanceRecords > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete device: It has ${maintenanceRecords} maintenance record(s) on file for compliance. Consider deactivating it instead.`,
      });
    }

    await Device.findByIdAndDelete(device._id);

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_DEVICE',
      category: 'DEVICE',
      details: { deviceId: device._id, name: device.name, code: device.deviceCode },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Device '${device.name}' removed successfully.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete device',
      error: err.message,
    });
  }
};
