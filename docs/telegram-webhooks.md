# Тестирование Telegram webhook и что можно получать

## Как это устроено

После подключения бота бэкенд вызывает `setWebhook`: Telegram **сам отправляет POST** на ваш URL (например `https://ваш-домен/telegram/webhook/{secret}`) при каждом событии с ботом. Тело запроса — JSON **Update** ([документация Telegram Bot API](https://core.telegram.org/bots/api#update)).

## Как тестировать

1. **Прод / публичный HTTPS**  
   Укажите `TELEGRAM_WEBHOOK_BASE_URL` на реальный адрес API (с учётом префикса `/api`, если nginx так проксирует). Подключите бота через CRM.

2. **Локально**  
   Варианты: туннель (**ngrok**, **Cloudflare Tunnel**) на порт бэкенда; или `TELEGRAM_WEBHOOK_SKIP=true` — webhook не ставится, события в Telegram на сервер не придут (удобно только для проверки подключения бота без приёма апдейтов).

3. **Проверка, что webhook стоит**  
   В браузере или curl:  
   `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`  
   Должен быть ваш URL и при успешных доставках небольшой `pending_update_count`.

4. **Имитация запроса**  
   Можно отправить POST на ваш endpoint с примером Update (как в доке Telegram), чтобы отладить парсер без Telegram.

## Что можно получать через webhook

| Событие | Пример в Update | Что извлекать |
|--------|------------------|---------------|
| Пользователь нажал **Start** или написал сообщение | `message` | `message.from`: `id`, `is_bot`, `first_name`, `last_name`, `username`, `language_code`; текст в `message.text` (для `/start` — обычно `"/start"` или `/start payload`) |
| Нажата **inline-кнопка** | `callback_query` | `callback_query.from`, `callback_query.data` |
| Пользователь отправил **контакт, фото, документ** | `message.contact`, `message.photo`, … | соответствующие поля в `message` |
| **Вход в бота** как таковой | Нет отдельного типа | Первое взаимодействие — это обычно сообщение `/start` или нажатие deep link |

То есть **да**: при нажатии «Старт» или первом сообщении вы получаете **профиль пользователя Telegram** (id, имя, username и т.д.) в `from`. Дальше вы можете сохранять этого пользователя как «клиента» в CRM, вести сценарии диалога, кнопки и т.д. — всё это приходит в следующих `Update` как новые сообщения и callback.

## Текущий код бэкенда

Сейчас обработчик в `telegram-webhook` только отвечает `200 { ok: true }`. Следующий шаг — разобрать `req.body`, по типу (`message`, `callback_query`, …) вызывать свои сервисы (создать клиента, записать шаг сценария и т.д.).
