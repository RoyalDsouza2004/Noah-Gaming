import GameCategory from '../models/GameCategory.js';
import Game from '../models/Game.js';
import ActivityLog from '../models/ActivityLog.js';

export const getAllCategories = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const categories = await GameCategory.find(filter).sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve categories',
      error: err.message,
    });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const category = await GameCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: err.message,
    });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, status = 'ACTIVE' } = req.body;

    const existing = await GameCategory.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Category with name '${name}' already exists.`,
      });
    }

    const category = new GameCategory({
      name: name.trim(),
      description: description ? description.trim() : '',
      status,
    });

    await category.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE_CATEGORY',
      category: 'DEVICE',
      details: { categoryId: category._id, name: category.name },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: err.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const category = await GameCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    if (name && name.trim() !== category.name) {
      const duplicate = await GameCategory.findOne({ name: name.trim(), _id: { $ne: category._id } });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `Category name '${name}' is already taken.`,
        });
      }
      category.name = name.trim();
    }

    if (typeof description === 'string') category.description = description.trim();
    if (status) category.status = status;

    await category.save();

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE_CATEGORY',
      category: 'DEVICE',
      details: { categoryId: category._id, name: category.name, status: category.status },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: { category },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: err.message,
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const category = await GameCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Check dependent records (Games)
    const dependentGamesCount = await Game.countDocuments({ category: category._id });
    if (dependentGamesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${dependentGamesCount} game(s) are currently associated with it. Please reassign or delete these games first.`,
      });
    }

    await GameCategory.findByIdAndDelete(category._id);

    await ActivityLog.create({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE_CATEGORY',
      category: 'DEVICE',
      details: { categoryId: category._id, name: category.name },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: err.message,
    });
  }
};
