// This script will be injected into the page to provide access to the Telegram API
(function() {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.onload = function() {
        window.postMessage({ type: "TELEGRAM_API_LOADED" }, "*");
    };
    document.head.appendChild(script);
})();