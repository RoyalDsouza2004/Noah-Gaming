import DeviceMaintenance from '../models/DeviceMaintenance.js';
import Device from '../models/Device.js';
import ActivityLog from '../models/ActivityLog.js';

export const getAllMaintenance = async (req, res) => {
  try {
    const { status, deviceId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (deviceId) filter.device = deviceId;

    const maintenanceList = await DeviceMaintenance.find(filter)
      .populate('device', 'name deviceCode deviceType status capacity')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { maintenanceList, total: maintenanceList.length },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance records',
      error: err.message,
    });
  }
};

export const getMaintenanceByDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const records = await DeviceMaintenance.find({ device: deviceId })
      .populate('device', 'name deviceCode deviceType status')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { records, total: records.length },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching device maintenance history',
      error: err.message,
    });
  }
};

export const createMaintenance = async (req, res) => {
  try {
    const { device: deviceId, reason, startDate, expectedEndDate, notes = '' } = req.body;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    const maintenance = new DeviceMaintenance({
      device: device._id,
      reason: reason.trim(),
      startDate: startDate ? new Date(startDate) : new Date(),
      expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
      notes: notes.trim(),
      status: 'IN_PROGRESS',
      createdBy: req.user._id,
    });

    await maintenance.save();

    // Set device status to MAINTENANCE
    device.status = 'MAINTENANCE';
    await device.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DEVICE_MAINTENANCE_START',
      category: 'DEVICE',
      details: {
        maintenanceId: maintenance._id,
        deviceId: device._id,
        deviceName: device.name,
        reason: maintenance.reason,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Device '${device.name}' marked under maintenance.`,
      data: { maintenance, device },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to record maintenance',
      error: err.message,
    });
  }
};

export const updateMaintenance = async (req, res) => {
  try {
    const { status, reason, expectedEndDate, actualEndDate, notes } = req.body;
    const maintenance = await DeviceMaintenance.findById(req.params.id);

    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found',
      });
    }

    if (reason) maintenance.reason = reason.trim();
    if (expectedEndDate !== undefined) maintenance.expectedEndDate = expectedEndDate ? new Date(expectedEndDate) : null;
    if (typeof notes === 'string') maintenance.notes = notes.trim();

    const previousStatus = maintenance.status;
    if (status) {
      maintenance.status = status;
    }

    // If marked as COMPLETED, record completion time and restore device to ACTIVE
    if (status === 'COMPLETED' && previousStatus !== 'COMPLETED') {
      maintenance.actualEndDate = actualEndDate ? new Date(actualEndDate) : new Date();

      const device = await Device.findById(maintenance.device);
      if (device && device.status === 'MAINTENANCE') {
        device.status = 'ACTIVE';
        await device.save();
      }
    } else if (status === 'CANCELLED' && previousStatus !== 'CANCELLED') {
      const device = await Device.findById(maintenance.device);
      if (device && device.status === 'MAINTENANCE') {
        device.status = 'ACTIVE';
        await device.save();
      }
    }

    await maintenance.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DEVICE_MAINTENANCE_UPDATE',
      category: 'DEVICE',
      details: {
        maintenanceId: maintenance._id,
        status: maintenance.status,
      },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: 'Maintenance record updated successfully.',
      data: { maintenance },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update maintenance record',
      error: err.message,
    });
  }
};
