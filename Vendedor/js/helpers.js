/* ============================================================
   INNOVA MÖBILI — Helpers: Funciones para DOM sin .style.
   ============================================================ */

/**
 * VISIBILIDAD
 */
function hide(element) {
  element?.classList.add('u-hidden');
}

function show(element) {
  element?.classList.remove('u-hidden');
}

function toggle(element) {
  element?.classList.toggle('u-hidden');
}

function setVisible(element, visible) {
  if (visible) show(element);
  else hide(element);
}

/**
 * CLASES
 */
function addClass(element, className) {
  element?.classList.add(className);
}

function removeClass(element, className) {
  element?.classList.remove(className);
}

function hasClass(element, className) {
  return element?.classList.contains(className) || false;
}

function toggleClass(element, className) {
  element?.classList.toggle(className);
}

/**
 * POSICIONAMIENTO
 */
function setFixed(element) {
  element?.classList.add('u-fixed', 'u-inset-0', 'u-z-top');
}

function setAbsolute(element) {
  element?.classList.add('u-absolute');
}

/**
 * FLEXBOX
 */
function setFlex(element, direction = 'row', center = false) {
  element?.classList.add('u-flex');
  if (direction === 'col') element.classList.add('u-flex-col');
  if (center) element.classList.add('u-flex-center');
}

function setFlexCenter(element) {
  element?.classList.add('u-flex-center');
}

function setFlexBetween(element) {
  element?.classList.add('u-flex-between');
}

/**
 * COLORES
 */
function setTextColor(element, color) {
  element?.classList.add(`u-text-${color}`);
}

function setBgColor(element, color) {
  element?.classList.add(`u-bg-${color}`);
}

function setAccentColor(element) {
  element?.classList.add('u-text-accent');
}

function setAccentBg(element) {
  element?.classList.add('u-bg-accent');
}

function setPrimaryBg(element) {
  element?.classList.add('u-bg-primary');
}

function setSuccessBg(element) {
  element?.classList.add('u-bg-success');
}

function setDangerBg(element) {
  element?.classList.add('u-bg-danger');
}

/**
 * ESPACIADO
 */
function setPadding(element, size = 3) {
  element?.classList.add(`u-p-${size}`);
}

function setMargin(element, size = 3) {
  element?.classList.add(`u-m-${size}`);
}

function setMarginBottom(element, size = 3) {
  element?.classList.add(`u-mb-${size}`);
}

function setMarginTop(element, size = 3) {
  element?.classList.add(`u-mt-${size}`);
}

function setGap(element, size = 3) {
  element?.classList.add(`u-gap-${size}`);
}

/**
 * BORDER RADIUS
 */
function setRounded(element, size = 'lg') {
  element?.classList.add(`u-rounded-${size}`);
}

/**
 * BORDES
 */
function setBorder(element, type = 'default') {
  if (type === 'dashed') element?.classList.add('u-border-dashed');
  else if (type === 'accent') element?.classList.add('u-border-accent');
  else element?.classList.add('u-border');
}

function setBorderBottom(element) {
  element?.classList.add('u-border-b');
}

function setBorderLeft(element, color = 'accent') {
  if (color === 'primary') element?.classList.add('u-border-left-primary');
  else element?.classList.add('u-border-left-accent');
}

/**
 * SOMBRAS
 */
function setShadow(element, size = 'md') {
  element?.classList.add(`u-shadow-${size}`);
}

/**
 * TIPOGRAFÍA
 */
function setBold(element) {
  element?.classList.add('u-font-bold');
}

function setTextSize(element, size = 'base') {
  element?.classList.add(`u-text-${size}`);
}

function setUppercase(element) {
  element?.classList.add('u-uppercase');
}

function setTextCenter(element) {
  element?.classList.add('u-text-center');
}

/**
 * CURSOR
 */
function setCursorPointer(element) {
  element?.classList.add('u-cursor-pointer');
}

/**
 * TRANSICIONES
 */
function setTransition(element, type = 'default') {
  if (type === 'colors') element?.classList.add('u-transition-colors');
  else if (type === 'fast') element?.classList.add('u-transition-fast');
  else element?.classList.add('u-transition');
}

/**
 * ESTADOS DE FORMULARIO
 */
function setFormError(input, error = true) {
  if (error) input?.classList.add('form-input--error');
  else input?.classList.remove('form-input--error');
}

function setFormSuccess(input, success = true) {
  if (success) input?.classList.add('form-input--success');
  else input?.classList.remove('form-input--success');
}

function setFormDisabled(input, disabled = true) {
  if (disabled) {
    input?.classList.add('form-input--disabled');
    if (input) {
      input.disabled = true;
    }
  } else {
    input?.classList.remove('form-input--disabled');
    if (input) {
      input.disabled = false;
    }
  }
}

/**
 * BOTONES
 */
function setButtonLoading(button, loading = true) {
  if (!button) return;
  if (loading) {
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = '<span class="spinner"></span> Cargando...';
  } else {
    button.disabled = false;
    button.classList.remove('is-loading');
  }
}

/**
 * OPCIONES COMBINADAS
 */
function createCard(options = {}) {
  const card = document.createElement('div');
  card.className = 'u-bg-white u-rounded-lg u-shadow-md u-p-4';

  if (options.padding) card.classList.add(`u-p-${options.padding}`);
  if (options.border) setBorder(card, options.border);
  if (options.bgColor) setBgColor(card, options.bgColor);

  return card;
}

function createButton(text, options = {}) {
  const button = document.createElement('button');
  button.textContent = text;
  button.className = 'form-btn form-btn--primary';

  if (options.secondary) {
    button.classList.remove('form-btn--primary');
    button.classList.add('form-btn--secondary');
  } else if (options.danger) {
    button.classList.remove('form-btn--primary');
    button.classList.add('form-btn--danger');
  }

  if (options.onClick) button.addEventListener('click', options.onClick);
  if (options.disabled) button.disabled = true;

  return button;
}

/**
 * UTILIDADES
 */
function getComputedColor(element) {
  return window.getComputedStyle(element).color;
}

function getElementHeight(element) {
  return element?.offsetHeight || 0;
}

function getElementWidth(element) {
  return element?.offsetWidth || 0;
}

function scrollIntoView(element, smooth = true) {
  if (element) {
    element.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'nearest'
    });
  }
}

/**
 * MODAL / OVERLAY (sin SweetAlert)
 */
function showBackdrop() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'app-backdrop';
  document.body.appendChild(backdrop);
  return backdrop;
}

function hideBackdrop() {
  const backdrop = document.getElementById('app-backdrop');
  if (backdrop) backdrop.remove();
}

function createModal(title, content, options = {}) {
  const backdrop = showBackdrop();
  const modal = document.createElement('div');
  modal.className = 'modal-glass';
  if (options.small) modal.classList.add('modal-glass--sm');
  if (options.large) modal.classList.add('modal-glass--lg');

  modal.innerHTML = `
    <button class="modal-close" onclick="this.closest('.modal-glass').remove();document.getElementById('app-backdrop')?.remove();">×</button>
    <h2 class="modal-title">${title}</h2>
    <div class="modal-content">${content}</div>
  `;

  if (options.onClose) {
    modal.querySelector('.modal-close').addEventListener('click', options.onClose);
  }

  document.body.appendChild(modal);
  return modal;
}

/**
 * FORMULARIOS
 */
function getFormData(formElement) {
  const formData = new FormData(formElement);
  return Object.fromEntries(formData);
}

function clearForm(formElement) {
  formElement?.reset();
  formElement?.querySelectorAll('input, textarea, select').forEach(input => {
    removeClass(input, 'form-input--error');
    removeClass(input, 'form-input--success');
  });
}

function validateInput(input, rules = {}) {
  let isValid = true;
  let errorMsg = '';

  if (rules.required && !input.value.trim()) {
    isValid = false;
    errorMsg = 'Este campo es requerido';
  }

  if (rules.email && input.value && !input.value.includes('@')) {
    isValid = false;
    errorMsg = 'Email inválido';
  }

  if (rules.minLength && input.value.length < rules.minLength) {
    isValid = false;
    errorMsg = `Mínimo ${rules.minLength} caracteres`;
  }

  if (rules.maxLength && input.value.length > rules.maxLength) {
    isValid = false;
    errorMsg = `Máximo ${rules.maxLength} caracteres`;
  }

  if (isValid) {
    setFormSuccess(input, true);
  } else {
    setFormError(input, true);
  }

  return { isValid, errorMsg };
}

/**
 * TABLAS
 */
function selectTableRow(row, selected = true) {
  if (selected) {
    row?.classList.add('table-row--selected');
  } else {
    row?.classList.remove('table-row--selected');
  }
}

function addBadgeToCell(cell, text, type = 'info') {
  const badge = document.createElement('span');
  badge.textContent = text;
  badge.className = `table-cell-badge table-badge--${type}`;
  cell.appendChild(badge);
}

/**
 * HTML SEGURO
 */
function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/`/g, '&#96;');
}

function jsStringAttr(value) {
  return escapeAttr(JSON.stringify(String(value ?? '')));
}

function setText(element, value) {
  if (element) element.textContent = value ?? '';
}

/**
 * NOTIFICACIONES / MENSAJES
 */
function showError(message) {
  // Usar SweetAlert si está disponible, si no crear un fallback
  if (typeof Swal !== 'undefined') {
    Swal.fire('Error', message, 'error');
  } else {
    console.error(message);
    alert(message);
  }
}

function showSuccess(message) {
  if (typeof Swal !== 'undefined') {
    Swal.fire('Éxito', message, 'success');
  } else {
    console.log(message);
  }
}

function showWarning(message) {
  if (typeof Swal !== 'undefined') {
    Swal.fire('Advertencia', message, 'warning');
  } else {
    console.warn(message);
  }
}

/**
 * PAGINACIÓN GENÉRICA (server-side)
 * ─────────────────────────────────────────────────────────────────────
 * Pinta los controles ‹« Ant 1 2 3 Sig »› con el mismo look que ya usaba
 * el catálogo (_cambiarPaginaCatalogo en catalogo.js), pero reutilizable
 * para cualquier vista paginada desde el backend.
 *
 * Uso:
 *   renderPaginacion(document.getElementById('mp-paginacion'), {
 *     page: data.page,
 *     totalPages: data.total_pages,
 *     onChange: (nuevaPagina) => cargarPagina(nuevaPagina)
 *   });
 *
 * onChange se llama con el número de página elegido; quien llama decide
 * qué hacer (normalmente: actualizar una variable de estado y volver a
 * pedir esa página al backend).
 */
function renderPaginacion(container, { page, totalPages, onChange }) {
  if (!container) return;
  if (!totalPages || totalPages <= 1) { container.innerHTML = ''; return; }

  const estiloBoton = (activo, deshabilitado) => `
    padding: 6px 12px; margin: 0 3px; border: 1px solid #cbd5e1;
    border-radius: 6px; font-weight: bold; transition: all 0.2s;
    cursor: ${deshabilitado ? 'not-allowed' : 'pointer'};
    background: ${activo ? '#0f172a' : 'white'};
    color: ${activo ? 'white' : (deshabilitado ? '#cbd5e1' : '#475569')};
  `;

  let botones = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      botones += `<button data-pag="${i}" style="${estiloBoton(i === page, false)}">${i}</button>`;
    } else if (i === page - 2 || i === page + 2) {
      botones += `<span style="color:#cbd5e1; padding:0 5px;">...</span>`;
    }
  }

  container.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; margin-top:20px; padding-bottom:10px; flex-wrap:wrap;">
      <button data-pag="${page - 1}" ${page === 1 ? 'disabled' : ''}
        style="${estiloBoton(false, page === 1)}">&laquo; Ant</button>
      ${botones}
      <button data-pag="${page + 1}" ${page === totalPages ? 'disabled' : ''}
        style="${estiloBoton(false, page === totalPages)}">Sig &raquo;</button>
    </div>`;

  container.querySelectorAll('button[data-pag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.pag, 10);
      if (p >= 1 && p <= totalPages && p !== page && typeof onChange === 'function') {
        onChange(p);
      }
    });
  });
}

/**
 * Debounce genérico — usado para no disparar un fetch al backend en cada
 * tecla que el usuario escribe en un buscador (espera a que pare de
 * escribir `delay` ms antes de ejecutar `fn`).
 */
function debounce(fn, delay = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * DEBUG / LOGGING
 */
function debugElement(element) {
  console.log('Element:', element);
  console.log('Classes:', element?.className);
  console.log('Computed Styles:', window.getComputedStyle(element));
}
