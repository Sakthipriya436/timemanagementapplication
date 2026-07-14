import React, { useState, useEffect, useRef } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { WS_URL } from './config';

function App() {
  const [token, setToken] = useState(localStorage.getItem('taskUserToken') || '');
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Load user data from localStorage if token exists
  useEffect(() => {
    const savedUser = localStorage.getItem('taskUserData');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, [token]);

  // Handle WebSocket Connection
  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setWsConnected(false);
      return;
    }

    const connectWebSocket = () => {
      // Close existing if open
      if (wsRef.current) {
        wsRef.current.close();
      }

      console.log('Connecting to WebSocket...');
      const ws = new WebSocket(`${WS_URL}/?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket Connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          console.log('WS Message Received:', payload);

          switch (payload.type) {
            case 'TASK_CREATED':
              setTasks((prevTasks) => {
                const exists = prevTasks.find((t) => t._id === payload.task._id);
                if (exists) return prevTasks;
                return [payload.task, ...prevTasks];
              });
              break;

            case 'TASK_UPDATED':
              setTasks((prevTasks) =>
                prevTasks.map((t) => (t._id === payload.task._id ? payload.task : t))
              );
              break;

            case 'TASK_DELETED':
              setTasks((prevTasks) => prevTasks.filter((t) => t._id !== payload.taskId));
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('Error processing WS event:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket Closed');
        setWsConnected(false);
        // Attempt reconnection after 3 seconds if token still exists
        if (localStorage.getItem('taskUserToken')) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.close();
      };
    };

    connectWebSocket();

    // Cleanup on unmount or token change
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token]);

  const handleAuthSuccess = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('taskUserToken');
    localStorage.removeItem('taskUserData');
    setToken('');
    setUser(null);
    setTasks([]);
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return (
    <>
      {!token ? (
        <Auth onAuthSuccess={handleAuthSuccess} />
      ) : (
        <Dashboard
          user={user}
          token={token}
          onLogout={handleLogout}
          tasks={tasks}
          setTasks={setTasks}
          wsConnected={wsConnected}
        />
      )}
    </>
  );
}

export default App;
