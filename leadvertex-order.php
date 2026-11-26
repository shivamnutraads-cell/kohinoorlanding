<?php
// LeadVertex order receiver. Keep API credentials on the server; never put them in index.html.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function reply($code, $payload) { http_response_code($code); echo json_encode($payload, JSON_UNESCAPED_UNICODE); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['success' => false, 'error' => 'Method not allowed']);
require __DIR__ . '/leadvertex-settings.php';
$name = trim((string)($_POST['name'] ?? ''));
$phone = preg_replace('/\D+/', '', (string)($_POST['mobile'] ?? ''));
$address = trim((string)($_POST['address'] ?? ''));
$pincode = preg_replace('/\D+/', '', (string)($_POST['pincode'] ?? ''));
if ($name === '' || !preg_match('/^[6-9][0-9]{9}$/', $phone) || $address === '' || !preg_match('/^[1-9][0-9]{5}$/', $pincode)) {
    reply(422, ['success' => false, 'error' => 'कृपया नाम, सही 10 अंकों का मोबाइल नंबर, पूरा पता और 6 अंकों का पिन कोड भरें।']);
}
if (!defined('LV_PROJECT') || !defined('LV_WEBMASTER_ID') || !defined('LV_API_TOKEN') || !defined('LV_GOOD_ID') || !defined('LV_PRODUCT_PRICE') || LV_API_TOKEN === '' || LV_GOOD_ID === '') {
    reply(503, ['success' => false, 'error' => 'LeadVertex integration setup अधूरा है। Admin को API token और Kohinoor product GoodID सेट करना होगा।']);
}
$project = preg_replace('/[^a-z0-9-]/i', '', LV_PROJECT);
$url = 'https://' . $project . '.leadvertex.ru/api/webmaster/v2/addOrder.html?' . http_build_query([
    'webmasterID' => LV_WEBMASTER_ID,
    'token' => LV_API_TOKEN
]);
$order = [
    'fio' => $name,
    'phone' => '+91' . $phone,
    'address' => $address,
    'index' => $pincode,
    'goods' => [[ 'goodID' => LV_GOOD_ID, 'quantity' => 1, 'price' => LV_PRODUCT_PRICE ]],
    'comment' => 'Landing page order; Kohinoor Advance Plus',
    'utm_source' => (string)($_POST['utm_source'] ?? ''),
    'utm_medium' => (string)($_POST['utm_medium'] ?? ''),
    'utm_campaign' => (string)($_POST['utm_campaign'] ?? ''),
    'utm_content' => (string)($_POST['utm_content'] ?? ''),
    'utm_term' => (string)($_POST['utm_term'] ?? ''),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? ''
];
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($order), CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'], CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 20]);
$body = curl_exec($ch); $curlError = curl_error($ch); $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
if ($body === false || $status < 200 || $status >= 300) {
    error_log('LeadVertex API transport error: ' . $curlError . '; HTTP ' . $status);
    reply(502, ['success' => false, 'error' => 'CRM से संपर्क नहीं हो पाया। कृपया कुछ देर बाद फिर कोशिश करें।']);
}
$data = json_decode($body, true);
// LeadVertex may return JSON or a plain response. Do not claim success for an explicit API error.
if (is_array($data) && (isset($data['error']) || (isset($data['success']) && $data['success'] === false))) {
    error_log('LeadVertex rejected order: ' . substr($body, 0, 1000));
    reply(502, ['success' => false, 'error' => 'LeadVertex ने ऑर्डर स्वीकार नहीं किया। कृपया विवरण जाँचें या सपोर्ट से संपर्क करें।']);
}
reply(200, ['success' => true]);
