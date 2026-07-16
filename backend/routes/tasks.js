import express from 'express';
import Task from '../models/Task.js';
import { protect } from '../middleware/auth.js';
import { broadcastToUser } from '../ws.js';

const router = express.Router();

// Apply auth middleware to protect all routes
router.use(protect);

// @desc    Get all user tasks (with search, status, and sorting filters)
// @route   GET /api/tasks
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, priority, search, sortBy } = req.query;
    
    // Base query scoped to the user
    let query = { user: req.user._id };

    // Apply status filter
    if (status && status !== 'All') {
      query.status = status;
    }

    // Apply priority filter
    if (priority && priority !== 'All') {
      query.priority = priority;
    }

    // Apply search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Setup sorting configuration
    let sortConfig = { createdAt: -1 }; // Default: Newest first
    if (sortBy) {
      if (sortBy === 'dueDate') {
        sortConfig = { dueDate: 1, createdAt: -1 }; // Due soonest, then newest
      } else if (sortBy === 'priority') {
        // Handle priority sorting (High -> Medium -> Low)
        // Since MongoDB does not naturally sort custom string enums, we'll sort them in JS if requested, or do an aggregation.
        // For simplicity and performance with user-scoped items, fetching and sorting in memory is fine,
        // or we can sort after the database query. Let's do simple db query first and sort in JS if needed.
      }
    }

    let tasks = await Task.find(query).sort(sortConfig);

    // Manual custom sorting for priority if requested
    if (sortBy === 'priority') {
      const priorityWeights = { High: 3, Medium: 2, Low: 1 };
      tasks = tasks.sort((a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]);
    }

    return res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    console.error('Fetch tasks error:', error);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Please add a task title' });
    }

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      user: req.user._id,
    });

    // Notify connected clients of this user in real-time
    broadcastToUser(req.user._id, { type: 'TASK_CREATED', task });

    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify task ownership
    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, error: 'Not authorized to update this task' });
    }

    const { title, description, status, priority, dueDate } = req.body;

    task.title = title !== undefined ? title : task.title;
    task.description = description !== undefined ? description : task.description;
    task.status = status !== undefined ? status : task.status;
    task.priority = priority !== undefined ? priority : task.priority;
    task.dueDate = dueDate !== undefined ? (dueDate || null) : task.dueDate;

    await task.save();

    // Notify connected clients of this user in real-time
    broadcastToUser(req.user._id, { type: 'TASK_UPDATED', task });

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify task ownership
    if (task.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, error: 'Not authorized to delete this task' });
    }

    await task.deleteOne();

    // Notify connected clients of this user in real-time
    broadcastToUser(req.user._id, { type: 'TASK_DELETED', taskId: req.params.id });

    return res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

export default router;
