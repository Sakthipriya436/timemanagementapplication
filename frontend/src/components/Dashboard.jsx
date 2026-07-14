import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

const Dashboard = ({ user, token, onLogout, tasks, setTasks, wsConnected }) => {
  const [selectedNav, setSelectedNav] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  // Form fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStatus, setTaskStatus] = useState('Todo');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch tasks helper
  const fetchTasks = async () => {
    try {
      let queryParams = new URLSearchParams();
      if (selectedNav !== 'All') queryParams.append('status', selectedNav);
      if (priorityFilter !== 'All') queryParams.append('priority', priorityFilter);
      if (searchQuery) queryParams.append('search', searchQuery);
      
      let sortParam = 'createdAt';
      if (sortBy === 'dueDate') sortParam = 'dueDate';
      if (sortBy === 'priority') sortParam = 'priority';
      queryParams.append('sortBy', sortParam);

      const response = await fetch(`${API_URL}/api/tasks?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  // Run fetch on filter modifications
  useEffect(() => {
    fetchTasks();
  }, [selectedNav, priorityFilter, sortBy, searchQuery]);

  // Open modal for creating task
  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskStatus('Todo');
    setTaskPriority('Medium');
    setTaskDueDate('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for editing task
  const handleOpenEditModal = (task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || '');
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Handle Form Submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!taskTitle.trim()) {
      setFormError('Task title is required');
      return;
    }

    const payload = {
      title: taskTitle,
      description: taskDesc,
      status: taskStatus,
      priority: taskPriority,
      dueDate: taskDueDate || null
    };

    const url = editingTask 
      ? `${API_URL}/api/tasks/${editingTask._id}` 
      : `${API_URL}/api/tasks`;
    const method = editingTask ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save task');
      }

      // Close modal
      setIsModalOpen(false);
      // Refresh local tasks (WebSocket will also trigger update, but refreshing guarantees sync)
      fetchTasks();
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Toggle quick complete status
  const handleToggleComplete = async (task) => {
    const updatedStatus = task.status === 'Completed' ? 'Todo' : 'Completed';
    try {
      const response = await fetch(`${API_URL}/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: updatedStatus })
      });
      if (response.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Error toggling complete status:', err);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Derived stats metrics
  const totalTasks = tasks.length;
  // Note: These calculations reflect the current visible task list filters, 
  // or we could fetch total metrics. Filtering locally gives dynamic dashboard stats!
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="app-container">
      {/* Sidebar Nav */}
      <aside className="glass-panel sidebar">
        <div className="logo-section">
          <div className="logo-icon">✓</div>
          <span>SyncTask</span>
        </div>

        <ul className="nav-list">
          <li 
            className={`nav-item ${selectedNav === 'All' ? 'active' : ''}`}
            onClick={() => setSelectedNav('All')}
          >
            <span>📁</span> All Tasks
          </li>
          <li 
            className={`nav-item ${selectedNav === 'Todo' ? 'active' : ''}`}
            onClick={() => setSelectedNav('Todo')}
          >
            <span>📝</span> To Do
          </li>
          <li 
            className={`nav-item ${selectedNav === 'In Progress' ? 'active' : ''}`}
            onClick={() => setSelectedNav('In Progress')}
          >
            <span>⚡</span> In Progress
          </li>
          <li 
            className={`nav-item ${selectedNav === 'Completed' ? 'active' : ''}`}
            onClick={() => setSelectedNav('Completed')}
          >
            <span>✅</span> Completed
          </li>
        </ul>

        <div className="user-profile">
          <div className="user-avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="user-email">{user?.email || 'user@example.com'}</div>
          </div>
          <button className="btn-logout" onClick={onLogout} title="Log Out">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main dashboard view */}
      <main className="main-content">
        {/* Header with connection and title */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '700' }}>Workspace</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem' }}>Organize, collaborate, and track tasks in real-time.</p>
          </div>

          <div className={`ws-indicator ${wsConnected ? 'connected' : 'disconnected'}`}>
            <div className="indicator-dot"></div>
            <span>{wsConnected ? 'Live Connection Sync' : 'Reconnecting...'}</span>
          </div>
        </header>

        {/* Stats Section */}
        <section className="stats-grid">
          <div className="glass-panel stat-card total">
            <span className="stat-title">Active Scope Tasks</span>
            <span className="stat-value">{totalTasks}</span>
          </div>
          <div className="glass-panel stat-card pending">
            <span className="stat-title">Pending Tasks</span>
            <span className="stat-value">{pendingTasks}</span>
          </div>
          <div className="glass-panel stat-card completed">
            <span className="stat-title">Completed Tasks</span>
            <span className="stat-value">{completedTasks}</span>
          </div>
          <div className="glass-panel stat-card rate">
            <span className="stat-title">Completion Rate</span>
            <span className="stat-value">{completionRate}%</span>
          </div>
        </section>

        {/* Filter bar */}
        <section className="control-bar">
          <div className="search-filter-group">
            <div className="search-wrapper">
              <input
                type="text"
                className="input-field"
                placeholder="Search task title or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
              <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }}>🔍</span>
            </div>

            <select 
              className="select-filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="All">All Priorities</option>
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
            </select>

            <select 
              className="select-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="dueDate">Sort: Due Date</option>
              <option value="priority">Sort: Highest Priority</option>
            </select>
          </div>

          <button className="btn-create" onClick={handleOpenCreateModal}>
            <span>+</span> Add New Task
          </button>
        </section>

        {/* Task Cards Grid */}
        <section className="tasks-container">
          {tasks.length > 0 ? (
            tasks.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';
              return (
                <div key={task._id} className={`glass-panel task-card ${task.status === 'Completed' ? 'completed-task' : ''}`}>
                  <div className="task-card-header">
                    <button 
                      className={`action-btn checkbox-btn ${task.status === 'Completed' ? 'checked' : ''}`}
                      onClick={() => handleToggleComplete(task)}
                      title={task.status === 'Completed' ? 'Mark Incomplete' : 'Mark Completed'}
                    >
                      {task.status === 'Completed' && '✓'}
                    </button>

                    <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                      {task.priority}
                    </span>
                  </div>

                  <h3 className="task-title">{task.title}</h3>
                  <p className="task-desc">{task.description || 'No description provided.'}</p>

                  <div className="task-card-footer">
                    <div className={`due-date ${isOverdue ? 'overdue' : ''}`}>
                      <span>📅</span> 
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}
                      {isOverdue && ' (Overdue)'}
                    </div>

                    <div className="task-actions">
                      <button className="action-btn edit-btn" onClick={() => handleOpenEditModal(task)} title="Edit Task">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button className="action-btn delete-btn" onClick={() => handleDeleteTask(task._id)} title="Delete Task">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="glass-panel no-tasks">
              <span style={{ fontSize: '2.5rem' }}>🏖️</span>
              <h3>No tasks found</h3>
              <p>Try refining your filters or create a new task to get started.</p>
            </div>
          )}
        </section>
      </main>

      {/* Task Modal Popup */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h2>{editingTask ? 'Edit Task Details' : 'Create New Task'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            {formError && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.9rem',
                marginBottom: '15px',
                textAlign: 'center'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label htmlFor="modal-title">Task Title</label>
                <input
                  id="modal-title"
                  type="text"
                  className="input-field"
                  placeholder="Review server logs"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-desc">Description</label>
                <textarea
                  id="modal-desc"
                  className="input-field"
                  placeholder="Add details about this task..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  rows="3"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label htmlFor="modal-status">Status</label>
                  <select
                    id="modal-status"
                    className="select-filter"
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Todo">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="modal-priority">Priority</label>
                  <select
                    id="modal-priority"
                    className="select-filter"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="modal-due">Due Date</label>
                <input
                  id="modal-due"
                  type="date"
                  className="input-field"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
