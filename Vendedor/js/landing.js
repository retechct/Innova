// ═══════════════════════════════════════════════════════════════
// LANDING INNOVA — Login por email+contraseña y Registro limpio
// ═══════════════════════════════════════════════════════════════

// ── Navbar: estado sesión cliente ────────────────────────────────
function imActualizarNavbarCliente() {
  const sesion = localStorage.getItem('usuarioInnova');
  const token = localStorage.getItem('innova_token');
  if (!sesion || !token) return;
  let u;
  try {
    u = JSON.parse(sesion);
  } catch (_error) {
    localStorage.removeItem('usuarioInnova');
    localStorage.removeItem('innova_token');
    localStorage.removeItem('innova_refresh_token');
    return;
  }
  // Solo aplica si el rol es Cliente (los trabajadores entran al ERP)
  if (u.rol !== 'Cliente') return;

  const navLinks = document.querySelector('.im-nav-links');
  if (!navLinks) return;

  // Reemplazar botones de registro/login por saludo + cerrar sesión
  const primerNombre = String(u.nombre || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
  navLinks.innerHTML = `
    <div id="im-nav-sesion">
      <p class="im-nav-saludo">Hola, <span>${escapeHTML(primerNombre)}</span></p>
      <button class="im-nav-link" onclick="abrirSeguimiento()" style="color:#c9a84c;border-color:rgba(201,168,76,0.4)">
        Mis Pedidos
      </button>
      <button id="im-nav-btn-logout" onclick="imCerrarSesionCliente()">
        Cerrar sesión
      </button>
    </div>
  `;

  // Cerrar el panel si estaba abierto
  const wrapper = document.getElementById('im-panel-wrapper');
  if (wrapper) { wrapper.classList.remove('visible'); imPanelActivo = null; }
}

function imCerrarSesionCliente() {
  Swal.fire({
    background: '#14100a', color: '#f5f0e8', icon: 'question',
    title: '¿Cerrar sesión?',
    showCancelButton: true,
    confirmButtonColor: '#c9a84c', cancelButtonColor: 'transparent',
    confirmButtonText: 'Sí, salir', cancelButtonText: 'Cancelar'
  }).then(r => {
    if (r.isConfirmed) {
      localStorage.removeItem('usuarioInnova');
      localStorage.removeItem('innova_token');
      localStorage.removeItem('innova_refresh_token');
      location.reload();
    }
  });
}

let imPanelActivo = null;

// ── Toggle mostrar/ocultar contraseña ────────────────────────────
function imTogglePass(inputId, iconEl) {
  const inp = document.getElementById(inputId);
  const ico = iconEl.querySelector('i');
  if (inp.type === 'password') {
    inp.type = 'text';
    ico.className = 'fa-regular fa-eye-slash';
  } else {
    inp.type = 'password';
    ico.className = 'fa-regular fa-eye';
  }
}

// ── Abrir / cerrar panel ─────────────────────────────────────────
function imAbrirPanel(tipo) {
  const wrapper   = document.getElementById('im-panel-wrapper');
  const formLogin = document.getElementById('im-form-login');
  const formReg   = document.getElementById('im-form-register');
  const btnLogin  = document.getElementById('btn-nav-login');

  if (imPanelActivo === tipo) {
    wrapper.classList.remove('visible');
    formLogin.classList.remove('active');
    formReg.classList.remove('active');
    btnLogin.classList.remove('active-panel');
    imPanelActivo = null;
    return;
  }
  imPanelActivo = tipo;
  formLogin.classList.remove('active');
  formReg.classList.remove('active');
  if (tipo === 'login') {
    formLogin.classList.add('active');
    btnLogin.classList.add('active-panel');
  } else {
    formReg.classList.add('active');
    btnLogin.classList.remove('active-panel');
  }
  wrapper.classList.add('visible');
}

// ── Scroll suave ─────────────────────────────────────────────────
function imScrollTo(id) {
  document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

// ── Navbar blur on scroll ────────────────────────────────────────
const imNavbar = document.getElementById('im-navbar');
document.getElementById('pantalla-login').addEventListener('scroll', function() {
  imNavbar.classList.toggle('scrolled', this.scrollTop > 40);
});

// Restaurar navbar si ya había sesión de cliente guardada
imActualizarNavbarCliente();

// ── LOGIN — correo + PIN ─────────────────────────────────────────
async function imEntrarAlSistema() {
  const email = (document.getElementById('login-email').value || '').trim();
  const pin   = (document.getElementById('login-pin').value || '').trim();

  if (!email || !pin) {
    return Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'warning',
      title:'Campos vacíos', text:'Ingresa tu correo y contraseña.',
      confirmButtonColor:'#c9a84c' });
  }
  if (pin.length < 4) {
    return Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'warning',
      title:'Contraseña muy corta', text:'La contraseña debe tener al menos 4 caracteres.',
      confirmButtonColor:'#c9a84c' });
  }

  try {
    const res  = await fetch(`${API_URL}/api/login/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pin })
    });
    const data = await res.json();

    if (data.exito) {
      usuarioActivo = data.usuario;
      usuarioActivo.horaLogin = new Date().toLocaleTimeString();
      if (!usuarioActivo.tienda && usuarioActivo.area_asignada) {
        usuarioActivo.tienda = usuarioActivo.area_asignada;
      }
      localStorage.setItem('usuarioInnova', JSON.stringify(usuarioActivo));
      // Guardar token JWT para las peticiones al API
      // FIX-1: localStorage persiste al recargar; sessionStorage se borraría
      if (data.token) localStorage.setItem('innova_token', data.token);
      if (data.refresh_token) localStorage.setItem('innova_refresh_token', data.refresh_token);

      // Cliente: se queda en el landing, no entra al panel
      if (usuarioActivo.rol === 'Cliente') {
        document.getElementById('pantalla-login').style.display = 'none';
        imActualizarNavbarCliente();
        abrirPortalCliente(usuarioActivo.email);
        return;
      }

      // Cualquier otro rol no reconocido: bloquear
      // ROLES_ERP viene de config.js — no redeclarar aquí
      if (!ROLES_ERP.includes(usuarioActivo.rol)) {
        localStorage.removeItem('usuarioInnova');
        localStorage.removeItem('innova_token');
        localStorage.removeItem('innova_refresh_token');
        return Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'warning',
          title:'Sin acceso', text:'Tu cuenta aún no tiene acceso al panel interno.',
          confirmButtonColor:'#c9a84c' });
      }

      // Trabajador: mostrar modal de sede ANTES de entrar al ERP
      document.getElementById('pantalla-login').style.display = 'none';
      // Cerrar panel de login
      const wrapper = document.getElementById('im-panel-wrapper');
      if (wrapper) wrapper.classList.remove('visible');
      imPanelActivo = null;

      // Solo Vendedores eligen la tienda/sede
      if (usuarioActivo.rol === 'Vendedor') {
          imMostrarModalSede();
      } else {
          // Otros roles entran directamente sin elegir sede
          configurarInterfazPorRol();
          mostrarUsuarioEnHeader();

          const esOperario = ['Operario','Jefe_Taller','JEFE_TALLER'].includes(usuarioActivo.rol);
          const esChofer   = usuarioActivo.rol === 'Chofer';
          const esAlmacen  = usuarioActivo.rol === 'ALMACEN';
          changeView(esChofer ? 'taller' : esOperario ? 'taller' : esAlmacen ? 'inventario' : 'catalogo');

          Swal.fire({
            background:'#14100a', color:'#f5f0e8', icon:'success',
            title:`¡Hola, ${usuarioActivo.nombre.split(' ')[0]}!`,
            timer: 2200, showConfirmButton: false
          });
      }
      return;
    } else {
      document.getElementById('login-pin').value = '';
      Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'error',
        title:'Acceso denegado', text: data.error || 'Correo o contraseña incorrectos.',
        confirmButtonColor:'#c9a84c' });
    }
  } catch(e) {
    Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'error',
      title:'Sin conexión', text:'No se pudo contactar el servidor.',
      confirmButtonColor:'#c9a84c' });
  }
}

// ── REGISTRO: validar y mostrar términos ─────────────────────────
function imSolicitarTerminos() {
  const nombre    = document.getElementById('reg-nombre').value.trim();
  const correo    = document.getElementById('reg-correo').value.trim();
  const telefono  = document.getElementById('reg-telefono').value.trim();
  const clave     = document.getElementById('reg-clave').value.trim();
  const clave2    = document.getElementById('reg-clave2').value.trim();

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

  if (!nombre || !correo || !clave || !clave2) {
    return Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'warning',
      title:'Campos incompletos', text:'Completa todos los campos.',
      confirmButtonColor:'#c9a84c' });
  }
  if (!emailValido) {
    return Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'warning',
      title:'Correo inválido', text:'Ingresa un correo electrónico válido.',
      confirmButtonColor:'#c9a84c' });
  }
  if (clave.length < 6) {
    return Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'warning',
      title:'Contraseña muy corta', text:'La contraseña debe tener al menos 6 caracteres.',
      confirmButtonColor:'#c9a84c' });
  }
  if (clave !== clave2) {
    document.getElementById('reg-clave2').value = '';
    return Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'error',
      title:'Las contraseñas no coinciden', text:'Verifica que ambas contraseñas sean iguales.',
      confirmButtonColor:'#c9a84c' });
  }
  document.getElementById('im-modal-terminos').classList.add('visible');
}

function imCerrarTerminos() {
  document.getElementById('im-modal-terminos').classList.remove('visible');
}

async function imAceptarTerminosYRegistrar() {
  imCerrarTerminos();
  const nombre   = document.getElementById('reg-nombre').value.trim();
  const correo   = document.getElementById('reg-correo').value.trim();
  const telefono = document.getElementById('reg-telefono').value.trim();
  const clave    = document.getElementById('reg-clave').value.trim();

  try {
    const res = await fetch(`${API_URL}/api/usuarios/registrar-web`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email: correo, contrasena: clave, telefono })
    });
    const data = await res.json();
    if (res.ok && data.exito) {
      Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'success',
        title:'¡Registro exitoso!',
        text:'Ya puedes iniciar sesión con tu correo y contraseña.',
        confirmButtonColor:'#c9a84c' });
      document.getElementById('reg-nombre').value    = '';
      document.getElementById('reg-correo').value    = '';
      document.getElementById('reg-telefono').value  = '';
      document.getElementById('reg-clave').value     = '';
      document.getElementById('reg-clave2').value    = '';
      imAbrirPanel('login');
    } else {
      Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'error',
        title:'Error al registrar', text: data.error || 'Intenta de nuevo.',
        confirmButtonColor:'#c9a84c' });
    }
  } catch(e) {
    Swal.fire({ background:'#14100a', color:'#f5f0e8', icon:'error',
      title:'Sin conexión', text:'No se pudo contactar el servidor.',
      confirmButtonColor:'#c9a84c' });
  }
}

// ── Botón de acceso rápido al ERP en el header ───────────────────
function imMostrarBotonTrabajador() {
  if (!usuarioActivo) return;
  const rolesPermitidos = ['Admin','Vendedor','Operario','Jefe_Taller','JEFE_TALLER','ALMACEN','Chofer'];
  if (!rolesPermitidos.includes(usuarioActivo.rol)) return;

  const header = document.querySelector('header');
  if (!header || document.getElementById('btn-erp-acceso')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-erp-acceso';
  btn.title = `Panel ERP — ${usuarioActivo.nombre}`;
  btn.innerHTML = `<i class="fa-solid fa-briefcase"></i>`;
  btn.style.cssText = `
    background: transparent;
    border: 1px solid rgba(201,168,76,0.45);
    color: #c9a84c;
    padding: 7px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 15px;
    transition: background 0.25s, color 0.25s;
    display: flex; align-items: center; gap: 7px;
  `;
  const label = document.createElement('span');
  label.style.cssText = 'font-family:Jost,sans-serif;font-size:11px;letter-spacing:0.1em;font-weight:400;';
  label.textContent = usuarioActivo.nombre.split(' ')[0];
  btn.appendChild(label);

  btn.onmouseenter = () => { btn.style.background = '#c9a84c'; btn.style.color = '#0d0b08'; };
  btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#c9a84c'; };
  btn.onclick = () => {
    if (!usuarioActivo) return;
    const _R = ['Admin','Vendedor','Operario','Jefe_Taller','JEFE_TALLER','ALMACEN','Chofer'];
    if (!_R.includes(usuarioActivo.rol)) return;
    document.getElementById('pantalla-login') &&
      (document.getElementById('pantalla-login').style.display = 'none');
    configurarInterfazPorRol();
    mostrarUsuarioEnHeader();
    const esOp  = ['Operario','Jefe_Taller','JEFE_TALLER'].includes(usuarioActivo.rol);
    const esAlm = usuarioActivo.rol === 'ALMACEN';
    changeView(esOp ? 'taller' : esAlm ? 'inventario' : 'catalogo');
  };

  const slot = document.getElementById('header-worker-slot');
  if (slot) slot.appendChild(btn);
  else header.appendChild(btn);
}

// ── Modal de sede post-login ──────────────────────────────────────
async function imMostrarModalSede() {
  const modal = document.getElementById('modal-sede');
  const sel   = document.getElementById('modal-sede-select');
  if (!modal || !sel) return;

  // Cargar sedes si aún no están
  if (sel.options.length <= 1) {
    try {
      const res  = await fetch(`${API_URL}/api/sedes`);
      const list = await res.json();
      if (!res.ok || !Array.isArray(list)) throw new Error('Respuesta de sedes inválida');
      list.forEach(s => {
        const option = new Option(String(s.nombre || 'Sede'), String(s.id || ''));
        option.dataset.nombre = String(s.nombre || 'Sede');
        sel.add(option);
      });
    } catch(e) { console.warn('No se pudieron cargar sedes', e); }
  }

  modal.style.display = 'flex';
}

function imConfirmarSede() {
  const sel   = document.getElementById('modal-sede-select');
  const error = document.getElementById('modal-sede-error');
  if (!sel.value) {
    error.style.display = 'block';
    return;
  }
  error.style.display = 'none';

  // Guardar sede en el usuario activo
  usuarioActivo.sede_id = sel.value;
  usuarioActivo.tienda  = sel.options[sel.selectedIndex].text;
  localStorage.setItem('usuarioInnova', JSON.stringify(usuarioActivo));
  // Guardar la fecha de hoy para no volver a preguntar hasta mañana
  const hoyPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  localStorage.setItem('innova_ultima_sede_check', hoyPeru);

  if (typeof localStorage !== 'undefined' && localStorage.getItem('innova_token')) {
    // token ya guardado en imEntrarAlSistema
  }

  // Cerrar modal
  document.getElementById('modal-sede').style.display = 'none';

  // Entrar al ERP
  configurarInterfazPorRol();
  mostrarUsuarioEnHeader();

  const esOperario = ['Operario','Jefe_Taller','JEFE_TALLER'].includes(usuarioActivo.rol);
  const esChofer   = usuarioActivo.rol === 'Chofer';
  const esAlmacen  = usuarioActivo.rol === 'ALMACEN';
  changeView(esChofer ? 'taller' : esOperario ? 'taller' : esAlmacen ? 'inventario' : 'catalogo');

  Swal.fire({
    background:'#14100a', color:'#f5f0e8', icon:'success',
    title:`¡Hola, ${usuarioActivo.nombre.split(' ')[0]}!`,
    text:`Sede: ${usuarioActivo.tienda}`,
    timer: 2200, showConfirmButton: false
  });
}

// ── Al cargar: restaurar estado según rol ───────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const sesion = localStorage.getItem('usuarioInnova');
  if (!sesion) return;
  try {
    const u = JSON.parse(sesion);
    // ROLES_ERP viene de config.js — no redeclarar aquí
    if (ROLES_ERP.includes(u.rol)) {
      // Trabajador: init() en modules/app/session_ui.js lo maneja, nada que hacer aquí
    } else {
      // Cliente: restaurar navbar con saludo y botón cerrar sesión
      usuarioActivo = u;
      setTimeout(imActualizarNavbarCliente, 100);
    }
  } catch(e) {}
});
