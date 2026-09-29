<?php
/**
 * index.php — обработчик формы обратной связи.
 *
 * GET  /            → отдаём index.html (чтобы `php -S localhost:8080` открывал страницу)
 * POST /index.php   → принимаем данные формы, проверяем их и отвечаем JSON:
 *                     { "success": true,  "message": "Спасибо, заявка принята" }
 *                     { "success": false, "message": "...", "errors": { "name": "...", "email": "..." } }
 *
 * Данные принимаем в двух форматах: JSON (так отправляет main.js)
 * и application/x-www-form-urlencoded (обычная HTML-форма).
 */

declare(strict_types=1);

// ---------------------------------------------------------------------
// GET-запрос: показываем страницу
// ---------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    exit;
}

// ---------------------------------------------------------------------
// POST-запрос: обработка формы
// ---------------------------------------------------------------------
header('Content-Type: application/json; charset=utf-8');
// Ответ не должен кэшироваться браузером
header('Cache-Control: no-store');

/**
 * Отправляет JSON-ответ с нужным HTTP-статусом и завершает скрипт.
 */
function sendJson(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Читает данные формы из тела запроса: JSON или обычные POST-поля.
 * Возвращает массив ['name' => ..., 'email' => ...] со строками.
 */
function getRequestData(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            sendJson([
                'success' => false,
                'message' => 'Некорректный формат запроса',
            ], 400);
        }
        $source = $decoded;
    } else {
        $source = $_POST;
    }

    // Приводим значения к строкам и убираем пробелы по краям —
    // так «   » не пройдёт проверку на пустое поле
    return [
        'name'  => trim((string) ($source['name'] ?? '')),
        'email' => trim((string) ($source['email'] ?? '')),
    ];
}

/**
 * Серверная проверка данных. Дублирует правила из main.js,
 * потому что клиентской проверке доверять нельзя: JavaScript можно
 * отключить или отправить запрос напрямую, минуя браузер.
 *
 * Возвращает массив ошибок вида ['поле' => 'текст ошибки'].
 */
function validate(array $data): array
{
    $errors = [];

    // Имя: не пустое, минимум 2 символа (считаем символы, а не байты — важно для кириллицы)
    if ($data['name'] === '') {
        $errors['name'] = 'Пожалуйста, введите ваше имя';
    } elseif (mb_strlen($data['name']) < 2) {
        $errors['name'] = 'Имя должно содержать минимум 2 символа';
    } elseif (mb_strlen($data['name']) > 100) {
        $errors['name'] = 'Имя слишком длинное';
    }

    // E-mail: не пустой и в корректном формате (встроенный фильтр PHP)
    if ($data['email'] === '') {
        $errors['email'] = 'Пожалуйста, введите ваш e-mail';
    } elseif (filter_var($data['email'], FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = 'Введите корректный e-mail, например name@example.com';
    }

    return $errors;
}

$data = getRequestData();
$errors = validate($data);

if ($errors !== []) {
    // 422 Unprocessable Entity — данные получены, но не прошли проверку
    sendJson([
        'success' => false,
        'message' => 'Пожалуйста, исправьте ошибки в форме',
        'errors'  => $errors,
    ], 422);
}

// Здесь в реальном проекте было бы сохранение в базу или отправка письма.
// По условию задания реальную отправку делать не нужно.
// Экранируем имя на случай, если оно когда-нибудь будет выводиться в HTML.
$name = htmlspecialchars($data['name'], ENT_QUOTES, 'UTF-8');

sendJson([
    'success' => true,
    'message' => 'Спасибо, заявка принята',
    'data'    => [
        'name'  => $name,
        'email' => $data['email'],
    ],
]);
