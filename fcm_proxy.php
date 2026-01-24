<?php
/**
 * SHOWLYTM - FCM CORS PROXY
 * 
 * Bu dosya tarayıcıdaki CORS engelini aşmak için kullanılır.
 * Tarayıcı (Chrome/Safari) doğrudan Google FCM API'sine gidemez.
 * Bu PHP dosyası sunucuda çalışır ve Google'a isteği o gönderir.
 */

// CORS ayarları
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// OPTIONS isteği (preflight) için hemen cevap ver
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Sadece POST isteklerini kabul et
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Content-Type: application/json");
    echo json_encode(["error" => "Only POST requests are allowed"]);
    exit;
}

// Gelen JSON verisini al
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

// Authorization header'ını al
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

if (empty($authHeader)) {
    // Bazı sunucularda Authorization header'ı farklı gelebilir
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
}

// Google FCM API'sine isteği ilet
$url = 'https://fcm.googleapis.com/fcm/send';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: ' . $authHeader
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $inputJSON);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // SSL hatalarını görmezden gel

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    $error_msg = curl_error($ch);
}
curl_close($ch);

// Sonucu tarayıcıya geri döndür
header("Content-Type: application/json");
http_response_code($httpCode);

if (isset($error_msg)) {
    echo json_encode(["error" => "CURL Error: " . $error_msg]);
} else {
    echo $response;
}
?>
