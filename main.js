/**
 * main.js — вся логика страницы на нативном JavaScript:
 *  1. мобильное меню (бургер);
 *  2. popup с формой обратной связи;
 *  3. валидация формы на клиенте;
 *  4. отправка формы через Fetch API (POST, JSON) в index.php.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Вспомогательные функции
   * ---------------------------------------------------------------- */

  // Блокируем прокрутку страницы, пока открыт любой оверлей.
  // Считаем открытые оверлеи, чтобы закрытие меню не «разблокировало»
  // страницу, если в этот момент ещё открыт popup (и наоборот).
  var openOverlays = 0;
  function lockScroll(lock) {
    openOverlays += lock ? 1 : -1;
    if (openOverlays < 0) openOverlays = 0;
    document.body.classList.toggle('no-scroll', openOverlays > 0);
  }

  /* ------------------------------------------------------------------
   * 1. Мобильное меню
   * ---------------------------------------------------------------- */
  var menu = document.getElementById('mobile-menu');
  var burger = document.querySelector('[data-menu-open]');

  function openMenu() {
    if (menu.classList.contains('is-open')) return;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    lockScroll(true);
  }

  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    lockScroll(false);
    burger.focus();
  }

  burger.addEventListener('click', openMenu);
  menu.querySelectorAll('[data-menu-close]').forEach(function (el) {
    el.addEventListener('click', closeMenu);
  });

  // На планшете и телефоне в макете у поиска короткий placeholder
  var searchInput = document.querySelector('.search__input');
  var mobileQuery = window.matchMedia('(max-width: 1023px)');
  function updateSearchPlaceholder() {
    searchInput.placeholder = mobileQuery.matches
      ? 'Поиск товаров'
      : 'Поиск по названию или коду товара';
  }
  updateSearchPlaceholder();
  mobileQuery.addEventListener('change', updateSearchPlaceholder);

  /* ------------------------------------------------------------------
   * 2. Popup с формой
   * ---------------------------------------------------------------- */
  var popup = document.getElementById('feedback-popup');
  var form = document.getElementById('feedback-form');
  var successBlock = popup.querySelector('.form__success');
  var successText = popup.querySelector('.form__success-text');
  var statusEl = form.querySelector('.form__status');
  var submitBtn = form.querySelector('.form__submit');
  var nameInput = form.elements.name;
  var emailInput = form.elements.email;

  // Элемент, с которого открыли popup — вернём на него фокус после закрытия
  var lastFocused = null;

  function openPopup() {
    if (popup.classList.contains('is-open')) return;
    lastFocused = document.activeElement;
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    // Ставим фокус в первое поле (после старта анимации появления)
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  function closePopup() {
    if (!popup.classList.contains('is-open')) return;
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    lockScroll(false);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();

    // Если форма была успешно отправлена — после закрытия возвращаем её
    // в исходное состояние, чтобы popup можно было открыть и заполнить заново.
    // Ждём окончания анимации скрытия (250 мс), чтобы смена не была видна.
    if (!successBlock.hidden) {
      setTimeout(resetForm, 300);
    }
  }

  function resetForm() {
    form.reset();
    [nameInput, emailInput].forEach(function (input) { setFieldError(input, ''); });
    statusEl.textContent = '';
    successBlock.hidden = true;
    form.hidden = false;
  }

  document.querySelectorAll('[data-popup-open]').forEach(function (el) {
    el.addEventListener('click', openPopup);
  });

  // Закрытие: крестик, кнопка «Закрыть» после успеха и клик по затемнённому фону.
  // Все они помечены атрибутом data-popup-close.
  popup.querySelectorAll('[data-popup-close]').forEach(function (el) {
    el.addEventListener('click', closePopup);
  });

  // Закрытие по клавише Escape — сначала popup, потом меню
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (popup.classList.contains('is-open')) closePopup();
    else if (menu.classList.contains('is-open')) closeMenu();
  });

  /* ------------------------------------------------------------------
   * 3. Валидация формы
   * ---------------------------------------------------------------- */

  // Простая, но достаточно строгая проверка формата e-mail:
  // «что-то@что-то.домен», без пробелов, домен минимум из двух частей.
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /**
   * Проверяет одно поле и возвращает текст ошибки или пустую строку.
   * Те же правила продублированы на сервере в index.php.
   */
  function validateField(input) {
    var value = input.value.trim();

    if (input === nameInput) {
      if (value === '') return 'Пожалуйста, введите ваше имя';
      if (value.length < 2) return 'Имя должно содержать минимум 2 символа';
    }

    if (input === emailInput) {
      if (value === '') return 'Пожалуйста, введите ваш e-mail';
      if (!EMAIL_RE.test(value)) return 'Введите корректный e-mail, например name@example.com';
    }

    return '';
  }

  // Показывает/скрывает сообщение об ошибке под полем
  function setFieldError(input, message) {
    var errorEl = form.querySelector('[data-error-for="' + input.name + '"]');
    input.classList.toggle('is-invalid', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    errorEl.textContent = message;
  }

  // Проверяет всю форму, подсвечивает ошибки. Возвращает true, если всё верно.
  function validateForm() {
    var isValid = true;
    [nameInput, emailInput].forEach(function (input) {
      var error = validateField(input);
      setFieldError(input, error);
      if (error) isValid = false;
    });
    return isValid;
  }

  // Живая проверка: ошибка появляется при уходе с поля
  // и исчезает, как только пользователь исправил значение.
  [nameInput, emailInput].forEach(function (input) {
    input.addEventListener('blur', function () {
      setFieldError(input, validateField(input));
    });
    input.addEventListener('input', function () {
      if (input.classList.contains('is-invalid')) {
        setFieldError(input, validateField(input));
      }
      statusEl.textContent = '';
    });
  });

  /* ------------------------------------------------------------------
   * 4. AJAX-отправка через Fetch API
   * ---------------------------------------------------------------- */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Отправка…' : 'Отправить';
  }

  // Показывает ответ сервера об ошибках: и общее сообщение, и ошибки по полям
  function showServerErrors(data) {
    if (data && data.errors) {
      Object.keys(data.errors).forEach(function (fieldName) {
        var input = form.elements[fieldName];
        if (input) setFieldError(input, data.errors[fieldName]);
      });
    }
    statusEl.textContent = (data && data.message) || 'Не удалось отправить форму. Попробуйте ещё раз.';
  }

  function showSuccess(message) {
    form.hidden = true;
    successBlock.hidden = false;
    successText.textContent = message;
    successBlock.querySelector('button').focus();
  }

  form.addEventListener('submit', function (e) {
    // Отменяем стандартную отправку — страница не перезагружается
    e.preventDefault();
    statusEl.textContent = '';

    // Сначала проверяем данные; при ошибках запрос не отправляем
    if (!validateForm()) {
      var firstInvalid = form.querySelector('.is-invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim()
    };

    setLoading(true);

    fetch('index.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        // Сервер отвечает JSON и при успехе (200), и при ошибке валидации (422),
        // поэтому разбираем тело в любом случае и смотрим на поле success
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          showSuccess(result.data.message);
        } else {
          showServerErrors(result.data);
        }
      })
      .catch(function () {
        // Сюда попадаем при обрыве сети или если ответ — не JSON
        // (например, сервер вернул HTML с ошибкой PHP)
        statusEl.textContent = 'Ошибка соединения с сервером. Проверьте, что страница открыта через PHP-сервер, и попробуйте снова.';
      })
      .finally(function () {
        setLoading(false);
      });
  });
})();
