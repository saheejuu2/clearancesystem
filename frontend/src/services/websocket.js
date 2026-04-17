/**
 * WebSocket service for real-time patient data updates
 * Handles connection, reconnection, and message broadcasting
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = null;
    this.baseUrl = null; // Store base URL for reconnection
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map(); // { eventType: [callbacks] }
    this.isIntentionallyClosed = false;
  }

  /**
   * Connect to WebSocket server
   * @param {string} baseUrl - Base URL (e.g., 'http://localhost:5173')
   */
  connect(baseUrl) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    this.baseUrl = baseUrl; // Store for reconnection
    // Connect to Node.js WebSocket server on port 8080
    const host = baseUrl.replace(/^https?:\/\//, '').split(':')[0]; // Extract hostname
    this.url = `ws://${host}:8080`;

    console.log('Connecting to WebSocket:', this.url);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data.type);
          this.emit(data.type, data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.emit('disconnected');
        if (!this.isIntentionallyClosed) {
          this.attemptReconnect();
        }
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (!this.isIntentionallyClosed && this.baseUrl) {
        this.connect(this.baseUrl);
      }
    }, delay);
  }

  /**
   * Send message to server
   * @param {string} type - Message type
   * @param {object} data - Message data
   */
  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type, ...data }));
    } catch (e) {
      console.error('Failed to send WebSocket message:', e);
    }
  }

  /**
   * Subscribe to event
   * @param {string} eventType - Event type to listen for
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to all listeners
   * @param {string} eventType - Event type
   * @param {*} data - Event data
   */
  emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in listener for ${eventType}:`, e);
        }
      });
    }
  }

  /**
   * Subscribe to patient updates for a specific role
   * @param {string} role - User role/cost center
   * @param {string} date - Date filter (YYYY-MM-DD)
   */
  subscribeToPatients(role, date) {
    this.send('subscribe_patients', { role, date });
  }

  /**
   * Unsubscribe from patient updates
   */
  unsubscribeFromPatients() {
    this.send('unsubscribe_patients');
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
