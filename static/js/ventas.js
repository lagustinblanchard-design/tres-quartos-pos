// Estado del carrito
let carrito = [];
let metodoPago = 'efectivo';
let productoSeleccionado = null;
let buscarTimeout = null;

// ── BÚSQUEDA ──
document.getElementById('search-input').addEventListener('input', function() {
  clearTimeout(buscarTimeout);
  buscarTimeout = setTimeout(buscarProductos, 200);
});

document.getElementById('cat-filter').addEventListener('change', buscarProductos);
document.getElementById('descuento-global').addEventListener('input', actualizarTotales);

function buscarProductos() {
  const q = document.getElementById('search-input').value.trim();
  const cat = document.getElementById('cat-filter').value;
  const grid = document.getElementById('productos-grid');

  if (!q && !cat) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">Escribí algo para buscar productos...</div>';
    return;
  }

  fetch(`/ventas/api/productos?q=${encodeURIComponent(q)}&cat=${cat}`)
    .then(r => r.json())
    .then(productos => {
      if (productos.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px;">Sin resultados</div>';
        return;
      }
      grid.innerHTML = productos.map(p => `
        <div class="producto-card" onclick="seleccionarProducto(${JSON.stringify(JSON.stringify(p))})">
          <div class="prod-nombre">${p.nombre}</div>
          <div class="prod-precio">${formatPesos(p.precio_venta)}</div>
          <div class="prod-stock text-muted">${p.categoria || ''}</div>
        </div>
      `).join('');
    });
}

function seleccionarProducto(pStr) {
  const p = JSON.parse(pStr);
  if (!p.variantes || p.variantes.length === 0) {
    agregarAlCarrito({ variante_id: null, producto_nombre: p.nombre, talla: '', color: '', precio_unitario: p.precio_venta });
    return;
  }
  if (p.variantes.length === 1) {
    const v = p.variantes[0];
    agregarAlCarrito({ variante_id: v.id, producto_nombre: p.nombre, talla: v.talla, color: v.color, precio_unitario: p.precio_venta, stock: v.stock });
    return;
  }
  // Mostrar modal de variantes
  productoSeleccionado = p;
  document.getElementById('modal-prod-nombre').textContent = p.nombre;
  const grid = document.getElementById('modal-variantes-grid');
  grid.innerHTML = p.variantes.map(v => `
    <button class="metodo-btn" style="padding:12px 8px;" onclick="elegirVariante(${v.id})">
      ${v.talla ? v.talla : ''}${v.color ? ' / ' + v.color : ''}<br>
      <small style="color:var(--text-muted)">Stock: ${v.stock}</small>
    </button>
  `).join('');
  document.getElementById('modal-variante').classList.add('open');
}

function elegirVariante(vid) {
  const v = productoSeleccionado.variantes.find(x => x.id === vid);
  agregarAlCarrito({
    variante_id: v.id,
    producto_nombre: productoSeleccionado.nombre,
    talla: v.talla,
    color: v.color,
    precio_unitario: productoSeleccionado.precio_venta,
    stock: v.stock,
  });
  cerrarModal();
}

function cerrarModal() {
  document.getElementById('modal-variante').classList.remove('open');
}

// ── CARRITO ──
function agregarAlCarrito(item) {
  const key = item.variante_id || item.producto_nombre;
  const existente = carrito.find(i => (i.variante_id || i.producto_nombre) === key);
  if (existente) {
    existente.cantidad++;
  } else {
    carrito.push({ ...item, cantidad: 1, descuento: 0 });
  }
  renderCarrito();
}

function cambiarCantidad(idx, delta) {
  carrito[idx].cantidad = Math.max(1, carrito[idx].cantidad + delta);
  renderCarrito();
}

function quitarItem(idx) {
  carrito.splice(idx, 1);
  renderCarrito();
}

function cambiarDescuento(idx, val) {
  carrito[idx].descuento = Math.min(100, Math.max(0, parseFloat(val) || 0));
  actualizarTotales();
}

function renderCarrito() {
  const container = document.getElementById('carrito-items');
  const vacio = document.getElementById('carrito-vacio');

  if (carrito.length === 0) {
    container.innerHTML = '';
    container.appendChild(vacio);
    vacio.style.display = 'block';
    document.getElementById('btn-cobrar').disabled = true;
    actualizarTotales();
    document.dispatchEvent(new CustomEvent('carrito-updated', { detail: 0 }));
    return;
  }

  vacio.style.display = 'none';
  container.innerHTML = carrito.map((item, idx) => {
    const sub = item.precio_unitario * item.cantidad * (1 - item.descuento / 100);
    const meta = [item.talla, item.color].filter(Boolean).join(' / ');
    return `
      <div class="carrito-item">
        <div class="carrito-item-name">${item.producto_nombre}</div>
        ${meta ? `<div class="carrito-item-meta">${meta}</div>` : ''}
        <div class="carrito-item-row">
          <div class="qty-control">
            <button class="qty-btn" onclick="cambiarCantidad(${idx}, -1)">−</button>
            <span class="qty-val">${item.cantidad}</span>
            <button class="qty-btn" onclick="cambiarCantidad(${idx}, 1)">+</button>
          </div>
          <input type="number" value="${item.descuento}" min="0" max="100"
                 style="width:52px;padding:4px 6px;font-size:12px;" class="form-control"
                 placeholder="%" title="Descuento %" onchange="cambiarDescuento(${idx}, this.value)">
          <span class="item-subtotal">${formatPesos(sub)}</span>
          <button onclick="quitarItem(${idx})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;">✕</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('btn-cobrar').disabled = false;
  actualizarTotales();
  document.dispatchEvent(new CustomEvent('carrito-updated', { detail: carrito.length }));
}

function actualizarTotales() {
  const subtotal = carrito.reduce((acc, i) => acc + i.precio_unitario * i.cantidad * (1 - i.descuento / 100), 0);
  const descGlobal = parseFloat(document.getElementById('descuento-global').value) || 0;
  const total = subtotal * (1 - descGlobal / 100);
  document.getElementById('subtotal-display').textContent = formatPesos(subtotal);
  document.getElementById('total-display').textContent = formatPesos(total);
  document.getElementById('carrito-count').textContent = `(${carrito.length} ítem${carrito.length !== 1 ? 's' : ''})`;
  calcVuelto();
}

function calcVuelto() {
  const descGlobal = parseFloat(document.getElementById('descuento-global').value) || 0;
  const subtotal = carrito.reduce((acc, i) => acc + i.precio_unitario * i.cantidad * (1 - i.descuento / 100), 0);
  const total = subtotal * (1 - descGlobal / 100);
  const recibido = parseFloat(document.getElementById('efectivo-recibido').value) || 0;
  const vuelto = recibido - total;
  document.getElementById('vuelto-display').textContent = vuelto >= 0 ? formatPesos(vuelto) : '—';
  document.getElementById('vuelto-display').style.color = vuelto >= 0 ? 'var(--success)' : 'var(--danger)';
}

function setMetodo(metodo, btn) {
  metodoPago = metodo;
  document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('vuelto-row').style.display = metodo === 'efectivo' ? 'block' : 'none';
}

// ── COBRAR ──
function cobrar() {
  if (carrito.length === 0) return;
  const descGlobal = parseFloat(document.getElementById('descuento-global').value) || 0;
  const payload = {
    items: carrito.map(i => ({
      variante_id: i.variante_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      descuento: i.descuento,
    })),
    metodo_pago: metodoPago,
    descuento_global: descGlobal,
  };

  fetch('/ventas/cobrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }
      mostrarTicket(data.ticket);
      limpiarCarrito();
    })
    .catch(() => alert('Error al registrar la venta.'));
}

function limpiarCarrito() {
  carrito = [];
  renderCarrito();
  document.getElementById('descuento-global').value = 0;
  document.getElementById('efectivo-recibido').value = '';
}

// ── TICKET ──
function mostrarTicket(t) {
  const lineas = t.items.map(i => {
    const meta = [i.talla, i.color].filter(Boolean).join('/');
    return `${i.nombre}${meta ? ' (' + meta + ')' : ''}\n  ${i.cantidad} x ${formatPesos(i.precio_unitario)}${i.descuento ? ' -' + i.descuento + '%' : ''}  =  ${formatPesos(i.subtotal)}`;
  }).join('\n');

  const html = `<pre style="margin:0;white-space:pre-wrap;">
================================
       TRES QUARTOS
================================
Vendedor: ${t.vendedor}
Fecha:    ${t.fecha}
Venta #${t.venta_id}
--------------------------------
${lineas}
--------------------------------
Subtotal: ${formatPesos(t.subtotal)}
${t.descuento_global > 0 ? 'Descuento: ' + t.descuento_global + '%\n' : ''}TOTAL:    ${formatPesos(t.total)}
Pago:     ${t.metodo_pago}
================================
      ¡Gracias por tu compra!
================================</pre>`;

  document.getElementById('ticket-content').innerHTML = html;
  document.getElementById('modal-ticket').classList.add('open');
}

function cerrarTicket() {
  document.getElementById('modal-ticket').classList.remove('open');
  document.getElementById('search-input').focus();
}

// ── UTILS ──
function formatPesos(v) {
  if (!v && v !== 0) return '$0';
  return '$' + Math.round(v).toLocaleString('es-AR');
}

// Cerrar modales con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cerrarModal();
    document.getElementById('modal-ticket').classList.remove('open');
  }
});

// Inicializar
document.getElementById('vuelto-row').style.display = 'block';
document.getElementById('search-input').focus();
