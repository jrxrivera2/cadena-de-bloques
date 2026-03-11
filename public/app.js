let botellaVerificadaId = null;
let qrScanner = null;

// ========== UTILIDADES ==========
function showAlert(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.className = `alert alert-${type} show`;
    el.innerHTML = message;
    setTimeout(() => el.classList.remove('show'), 5000);
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleString('es-CO', {
        dateStyle: 'medium', timeStyle: 'short'
    });
}

function tipoLabel(tipo) {
    const labels = {
        registro: 'Registro',
        transporte: 'Transporte',
        mayorista: 'Mayorista',
        minorista: 'Minorista',
        venta: 'Venta'
    };
    return labels[tipo] || tipo;
}

function renderTimeline(containerId, historial) {
    const container = document.getElementById(containerId);
    if (!historial || historial.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Sin eventos registrados</p></div>';
        return;
    }

    container.innerHTML = `<div class="timeline">
        ${historial.map(h => `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-title">
                        <span class="badge badge-${h.tipo}">${tipoLabel(h.tipo)}</span>
                        ${h.data.nombre ? ` ${h.data.nombre}` : ''}
                        ${h.data.descripcion ? ` - ${h.data.descripcion}` : ''}
                    </div>
                    <div class="timeline-desc">
                        ${h.data.responsable ? `Responsable: ${h.data.responsable}` : ''}
                        ${h.data.ubicacion ? ` | Ubicacion: ${h.data.ubicacion}` : ''}
                        ${h.data.fabricante ? `Fabricante: ${h.data.fabricante}` : ''}
                        ${h.data.marca ? ` | Marca: ${h.data.marca}` : ''}
                        ${h.data.consumidor ? `Consumidor: ${h.data.consumidor}` : ''}
                    </div>
                    <div class="timeline-meta">
                        ${formatDate(h.data.fecha || h.timestamp)} &middot; Hash: ${h.hash.substring(0, 16)}...
                    </div>
                </div>
            </div>
        `).join('')}
    </div>`;
}

// ========== NAVEGACION POR TABS ==========
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');

        if (tab.dataset.tab === 'admin') {
            cargarBotellasAdmin();
            cargarListaAdmin();
        }
        if (tab.dataset.tab === 'fabricante') cargarListaFabricante();
        if (tab.dataset.tab === 'consumidor') setTimeout(initQrScanner, 300);
    });
});

// ========== FABRICANTE ==========
document.getElementById('formBotella').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        nombre: document.getElementById('fab-nombre').value,
        marca: document.getElementById('fab-marca').value,
        lote: document.getElementById('fab-lote').value,
        fabricante: document.getElementById('fab-fabricante').value,
        descripcion: document.getElementById('fab-descripcion').value
    };

    try {
        const res = await fetch('/api/botella', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('alertFabricante', `Botella registrada con ID: <strong>${data.id}</strong>`, 'success');
            document.getElementById('qrResult').innerHTML = `
                <img src="${data.qrDataUrl}" alt="QR Code" width="250">
                <div class="qr-id">${data.id}</div>
                <p style="color:var(--gray-500); font-size:13px; margin-top:8px;">
                    ${body.nombre} - ${body.marca}
                </p>
                <button class="btn btn-outline" style="margin-top:12px;" onclick="descargarQR('${data.qrDataUrl}', '${data.id}')">
                    &#11015; Descargar QR
                </button>
            `;
            e.target.reset();
            cargarListaFabricante();
        } else {
            showAlert('alertFabricante', data.error, 'error');
        }
    } catch (err) {
        showAlert('alertFabricante', 'Error de conexion con el servidor', 'error');
    }
});

function descargarQR(dataUrl, id) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `CervezaChain-QR-${id}.png`;
    a.click();
}

async function cargarListaFabricante() {
    try {
        const res = await fetch('/api/botellas');
        const botellas = await res.json();
        const container = document.getElementById('listaBotellasFab');

        if (botellas.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">&#128230;</div><p>Aun no hay botellas registradas</p></div>';
            return;
        }

        container.innerHTML = `<table>
            <thead><tr>
                <th>ID</th><th>Cerveza</th><th>Marca</th><th>Lote</th><th>Estado</th><th>Bloques</th><th>QR</th>
            </tr></thead>
            <tbody>${botellas.map(b => `<tr>
                <td><strong>${b.id}</strong></td>
                <td>${b.nombre}</td>
                <td>${b.marca}</td>
                <td>${b.lote}</td>
                <td><span class="badge ${b.vendida ? 'badge-vendida' : 'badge-activa'}">${b.vendida ? 'Vendida' : 'Activa'}</span></td>
                <td>${b.bloques}</td>
                <td><button class="btn btn-outline" style="padding:4px 10px; font-size:12px;" onclick="verQR('${b.id}')">Ver QR</button></td>
            </tr>`).join('')}</tbody>
        </table>`;
    } catch (err) {
        console.error('Error cargando botellas:', err);
    }
}

async function verQR(id) {
    const res = await fetch(`/api/botella/${id}/qr`);
    const data = await res.json();
    document.getElementById('qrResult').innerHTML = `
        <img src="${data.qrDataUrl}" alt="QR" width="250" style="${data.invalidado ? 'opacity:0.3;filter:grayscale(1);' : ''}">
        <div class="qr-id">${id}</div>
        ${data.invalidado ? '<p style="color:var(--red);font-weight:600;margin-top:8px;">QR INVALIDADO</p>' : ''}
        ${!data.invalidado ? `<button class="btn btn-outline" style="margin-top:12px;" onclick="descargarQR('${data.qrDataUrl}', '${id}')">&#11015; Descargar QR</button>` : ''}
    `;
}

// ========== ADMINISTRADOR ==========
async function cargarBotellasAdmin() {
    try {
        const res = await fetch('/api/botellas');
        const botellas = await res.json();
        const select = document.getElementById('admin-botella');
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Seleccionar botella --</option>';
        botellas.filter(b => !b.vendida).forEach(b => {
            select.innerHTML += `<option value="${b.id}">${b.id} - ${b.nombre} (${b.marca})</option>`;
        });
        if (currentVal) select.value = currentVal;

        const total = botellas.length;
        const activas = botellas.filter(b => !b.vendida).length;
        const vendidas = botellas.filter(b => b.vendida).length;
        const totalBloques = botellas.reduce((sum, b) => sum + b.bloques, 0);

        document.getElementById('statsAdmin').innerHTML = `
            <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Botellas</div></div>
            <div class="stat-card"><div class="stat-value">${activas}</div><div class="stat-label">Activas</div></div>
            <div class="stat-card"><div class="stat-value">${vendidas}</div><div class="stat-label">Vendidas</div></div>
            <div class="stat-card"><div class="stat-value">${totalBloques}</div><div class="stat-label">Bloques Totales</div></div>
        `;
    } catch (err) {
        console.error('Error:', err);
    }
}

document.getElementById('admin-botella').addEventListener('change', async (e) => {
    if (e.target.value) await cargarHistorialAdmin(e.target.value);
});

async function cargarHistorialAdmin(id) {
    try {
        const res = await fetch(`/api/botella/${id}/historial`);
        const data = await res.json();
        renderTimeline('historialAdmin', data.historial);
    } catch (err) {
        console.error('Error:', err);
    }
}

document.getElementById('formTrazabilidad').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('admin-botella').value;
    if (!id) {
        showAlert('alertAdmin', 'Selecciona una botella primero', 'warning');
        return;
    }

    const body = {
        tipo: document.getElementById('admin-tipo').value,
        descripcion: document.getElementById('admin-descripcion').value,
        responsable: document.getElementById('admin-responsable').value,
        ubicacion: document.getElementById('admin-ubicacion').value
    };

    try {
        const res = await fetch(`/api/trazabilidad/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('alertAdmin', `Evento de <strong>${body.tipo}</strong> registrado exitosamente`, 'success');
            document.getElementById('admin-tipo').value = '';
            document.getElementById('admin-descripcion').value = '';
            document.getElementById('admin-responsable').value = '';
            document.getElementById('admin-ubicacion').value = '';
            cargarHistorialAdmin(id);
            cargarBotellasAdmin();
            cargarListaAdmin();
        } else {
            showAlert('alertAdmin', data.error, 'error');
        }
    } catch (err) {
        showAlert('alertAdmin', 'Error de conexion', 'error');
    }
});

async function cargarListaAdmin() {
    try {
        const res = await fetch('/api/botellas');
        const botellas = await res.json();
        const container = document.getElementById('listaBotellasAdmin');

        if (botellas.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">&#128230;</div><p>No hay botellas en el sistema</p></div>';
            return;
        }

        container.innerHTML = `<table>
            <thead><tr>
                <th>ID</th><th>Cerveza</th><th>Marca</th><th>Lote</th><th>Fabricante</th><th>Estado</th><th>Bloques</th><th>Accion</th>
            </tr></thead>
            <tbody>${botellas.map(b => `<tr>
                <td><strong>${b.id}</strong></td>
                <td>${b.nombre}</td>
                <td>${b.marca}</td>
                <td>${b.lote}</td>
                <td>${b.fabricante}</td>
                <td><span class="badge ${b.vendida ? 'badge-vendida' : 'badge-activa'}">${b.vendida ? 'Vendida' : 'Activa'}</span></td>
                <td>${b.bloques}</td>
                <td><button class="btn btn-outline" style="padding:4px 10px; font-size:12px;" onclick="verHistorialAdmin('${b.id}')">Historial</button></td>
            </tr>`).join('')}</tbody>
        </table>`;
    } catch (err) {
        console.error('Error:', err);
    }
}

async function verHistorialAdmin(id) {
    document.getElementById('admin-botella').value = id;
    await cargarHistorialAdmin(id);
    document.getElementById('historialAdmin').scrollIntoView({ behavior: 'smooth' });
}

// ========== CONSUMIDOR ==========
function initQrScanner() {
    if (qrScanner) return;
    try {
        qrScanner = new Html5QrcodeScanner("qr-reader", {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true
        }, false);
        qrScanner.render(onScanSuccess, onScanFailure);
        setTimeout(traducirScanner, 500);
    } catch (err) {
        console.log('Scanner no disponible:', err);
    }
}

function traducirScanner() {
    const traducciones = {
        'Request Camera Permissions': 'Permitir acceso a la camara',
        'Scan an Image File': 'Escanear archivo de imagen',
        'Stop Scanning': 'Detener escaneo',
        'Start Scanning': 'Iniciar escaneo',
        'Switch On Torch': 'Encender linterna',
        'Switch Off Torch': 'Apagar linterna',
        'Select Camera': 'Seleccionar camara',
        'Choose Image': 'Elegir imagen',
        'No camera found': 'No se encontro camara',
        'Scan an image file': 'Escanear archivo de imagen',
        'Or drop an image to scan': 'O arrastra una imagen para escanear',
        'No Image chosen': 'Ninguna imagen seleccionada',
        'Anonymous Camera': 'Camara'
    };

    const container = document.getElementById('qr-reader');
    if (!container) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const texto = node.textContent.trim();
        if (traducciones[texto]) {
            node.textContent = node.textContent.replace(texto, traducciones[texto]);
        }
    }

    container.querySelectorAll('button, a, input[type="button"]').forEach(el => {
        const texto = el.textContent.trim();
        if (traducciones[texto]) el.textContent = traducciones[texto];
        if (el.value && traducciones[el.value.trim()]) el.value = traducciones[el.value.trim()];
    });

    const observer = new MutationObserver(() => {
        const inner = document.getElementById('qr-reader');
        if (!inner) return;
        inner.querySelectorAll('button, a, span, input[type="button"]').forEach(el => {
            const texto = el.textContent.trim();
            if (traducciones[texto]) el.textContent = traducciones[texto];
            if (el.value && traducciones[el.value.trim()]) el.value = traducciones[el.value.trim()];
        });
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
}

function onScanSuccess(decodedText) {
    try {
        const data = JSON.parse(decodedText);
        if (data.id && data.sistema === 'CervezaChain') {
            document.getElementById('cons-id').value = data.id;
            verificarBotella(data.id);
            if (qrScanner) qrScanner.clear();
        }
    } catch {
        document.getElementById('cons-id').value = decodedText;
        verificarBotella(decodedText.trim());
    }
}

function onScanFailure() {}

function verificarManual() {
    const id = document.getElementById('cons-id').value.trim().toUpperCase();
    if (!id) return;
    verificarBotella(id);
}

async function verificarBotella(id) {
    try {
        const res = await fetch(`/api/verificar/${id}`);
        const data = await res.json();
        const container = document.getElementById('verifyResult');
        const detalleCard = document.getElementById('detalleConsumidor');
        const compraCard = document.getElementById('compraCard');

        if (data.autentica) {
            botellaVerificadaId = id;
            container.innerHTML = `
                <div class="verify-result">
                    <div class="verify-icon ok">&#10004;</div>
                    <h3 style="color:var(--green);">Botella Autentica</h3>
                    <p>${data.mensaje}</p>
                    <br>
                    <p><strong>${data.info.nombre}</strong> - ${data.info.marca}</p>
                    <p style="font-size:12px; color:var(--gray-400); margin-top:4px;">
                        Lote: ${data.info.lote} | Fabricante: ${data.info.fabricante}
                    </p>
                </div>
            `;
            renderTimeline('historialConsumidor', data.historial);
            detalleCard.style.display = 'block';
            compraCard.style.display = data.vendida ? 'none' : 'block';
        } else {
            botellaVerificadaId = null;
            container.innerHTML = `
                <div class="verify-result">
                    <div class="verify-icon fail">&#10060;</div>
                    <h3 style="color:var(--red);">Alerta de Fraude</h3>
                    <p>${data.mensaje}</p>
                </div>
            `;
            detalleCard.style.display = 'none';
            compraCard.style.display = 'none';
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

async function confirmarCompra() {
    if (!botellaVerificadaId) return;

    try {
        const res = await fetch(`/api/botella/${botellaVerificadaId}/comprar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consumidor: document.getElementById('cons-nombre').value || 'Anonimo'
            })
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('alertConsumidor', data.mensaje, 'success');
            document.getElementById('compraCard').style.display = 'none';
            verificarBotella(botellaVerificadaId);
            botellaVerificadaId = null;
        } else {
            showAlert('alertConsumidor', data.error, 'error');
        }
    } catch (err) {
        showAlert('alertConsumidor', 'Error de conexion', 'error');
    }
}

// ========== INICIALIZACION ==========
cargarListaFabricante();
