<?php
/**
 * CORS Helper - Apply to all API endpoints
 * Allows both localhost (development) and production domains
 */

$allowed_origins = [
    'http://localhost:5173',      // Vite dev server
    'http://localhost:3000',      // Alternative frontend port
    'http://localhost',           // Direct localhost
    'http://127.0.0.1:5173',     // Localhost IP
    'http://hesed-pc',            // Production domain
    'http://hesed-pc:8000',       // Production with port
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Allow origin if in whitelist
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // Fallback to wildcard for development
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
