<?php
/**
 * WebSocket server for real-time patient data updates
 * Handles client connections and broadcasts patient data changes
 */

require_once 'db_config.php';

// WebSocket server configuration
define('WS_PORT', 8080);
define('WS_HOST', '0.0.0.0');

class PatientWebSocketServer {
  private $clients = [];
  private $subscriptions = []; // { clientId: { role, date } }
  private $db;

  public function __construct($db) {
    $this->db = $db;
  }

  /**
   * Start the WebSocket server
   */
  public function start() {
    $socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
    if (!$socket) {
      die("socket_create() failed: " . socket_strerror(socket_last_error()) . "\n");
    }

    socket_set_option($socket, SOL_SOCKET, SO_REUSEADDR, 1);

    if (!socket_bind($socket, WS_HOST, WS_PORT)) {
      die("socket_bind() failed: " . socket_strerror(socket_last_error()) . "\n");
    }

    if (!socket_listen($socket, 5)) {
      die("socket_listen() failed: " . socket_strerror(socket_last_error()) . "\n");
    }

    echo "WebSocket server started on " . WS_HOST . ":" . WS_PORT . "\n";

    while (true) {
      $read = array_merge([$socket], array_keys($this->clients));
      $write = null;
      $except = null;

      if (socket_select($read, $write, $except, 1) < 1) {
        continue;
      }

      if (in_array($socket, $read)) {
        $client = socket_accept($socket);
        if ($client) {
          $clientId = uniqid();
          $this->clients[$clientId] = [
            'socket' => $client,
            'handshake' => false,
            'buffer' => ''
          ];
          echo "Client connected: $clientId\n";
        }
        $key = array_search($socket, $read);
        unset($read[$key]);
      }

      foreach ($read as $clientId => $clientSocket) {
        $data = @socket_read($clientSocket, 1024);

        if ($data === false || $data === '') {
          $this->disconnectClient($clientId);
          continue;
        }

        $this->clients[$clientId]['buffer'] .= $data;

        if (!$this->clients[$clientId]['handshake']) {
          if ($this->performHandshake($clientId, $data)) {
            $this->clients[$clientId]['handshake'] = true;
            echo "Client $clientId handshake completed\n";
          }
        } else {
          $this->handleMessage($clientId, $data);
        }
      }
    }
  }

  /**
   * Perform WebSocket handshake
   */
  private function performHandshake($clientId, $data) {
    if (preg_match("/Sec-WebSocket-Key: (.*)\r\n/", $data, $matches)) {
      $key = $matches[1];
      $hash = base64_encode(pack('H*', sha1($key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')));

      $response = "HTTP/1.1 101 Switching Protocols\r\n";
      $response .= "Upgrade: websocket\r\n";
      $response .= "Connection: Upgrade\r\n";
      $response .= "Sec-WebSocket-Accept: $hash\r\n\r\n";

      socket_write($this->clients[$clientId]['socket'], $response);
      return true;
    }
    return false;
  }

  /**
   * Handle incoming message
   */
  private function handleMessage($clientId, $data) {
    $message = $this->decodeFrame($data);

    if ($message === null) {
      return;
    }

    $msg = json_decode($message, true);
    if (!$msg) {
      return;
    }

    echo "Message from $clientId: " . $msg['type'] . "\n";

    switch ($msg['type']) {
      case 'subscribe_patients':
        $this->subscriptions[$clientId] = [
          'role' => $msg['role'] ?? null,
          'date' => $msg['date'] ?? date('Y-m-d')
        ];
        $this->sendToClient($clientId, 'subscribed', ['message' => 'Subscribed to patient updates']);
        break;

      case 'unsubscribe_patients':
        unset($this->subscriptions[$clientId]);
        $this->sendToClient($clientId, 'unsubscribed', ['message' => 'Unsubscribed from patient updates']);
        break;

      case 'ping':
        $this->sendToClient($clientId, 'pong', []);
        break;
    }
  }

  /**
   * Decode WebSocket frame
   */
  private function decodeFrame($data) {
    $unmasked = '';
    $payload = substr($data, 2);

    $mask = substr($payload, 0, 4);
    $payload = substr($payload, 4);

    for ($i = 0; $i < strlen($payload); $i++) {
      $unmasked .= chr(ord($payload[$i]) ^ ord($mask[$i % 4]));
    }

    return $unmasked;
  }

  /**
   * Encode WebSocket frame
   */
  private function encodeFrame($data) {
    $data = json_encode($data);
    $len = strlen($data);

    $frame = chr(0x81);

    if ($len < 126) {
      $frame .= chr($len);
    } elseif ($len < 65536) {
      $frame .= chr(126) . pack('n', $len);
    } else {
      $frame .= chr(127) . pack('N', 0) . pack('N', $len);
    }

    $frame .= $data;
    return $frame;
  }

  /**
   * Send message to specific client
   */
  private function sendToClient($clientId, $type, $data) {
    if (!isset($this->clients[$clientId])) {
      return;
    }

    $message = array_merge(['type' => $type], $data);
    $frame = $this->encodeFrame($message);

    @socket_write($this->clients[$clientId]['socket'], $frame);
  }

  /**
   * Broadcast patient update to subscribed clients
   */
  public function broadcastPatientUpdate($role, $date, $patients) {
    foreach ($this->subscriptions as $clientId => $sub) {
      if ($sub['role'] === $role && $sub['date'] === $date) {
        $this->sendToClient($clientId, 'patients_updated', [
          'patients' => $patients,
          'timestamp' => time()
        ]);
      }
    }
  }

  /**
   * Disconnect client
   */
  private function disconnectClient($clientId) {
    if (isset($this->clients[$clientId])) {
      @socket_close($this->clients[$clientId]['socket']);
      unset($this->clients[$clientId]);
      unset($this->subscriptions[$clientId]);
      echo "Client disconnected: $clientId\n";
    }
  }
}

// Start server if run from CLI
if (php_sapi_name() === 'cli') {
  $db = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
  if ($db->connect_error) {
    die("Connection failed: " . $db->connect_error);
  }

  $server = new PatientWebSocketServer($db);
  $server->start();
}
?>
