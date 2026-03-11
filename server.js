const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { BlockChain } = require('./cadenadebloques');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Almacén en memoria: { botellaId: { blockchain, qrDataUrl, vendida, qrInvalidado, info } }
const botellas = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================== FABRICANTE =====================

// Registrar botella nueva + generar QR
app.post('/api/botella', async (req, res) => {
    try {
        const { nombre, marca, lote, fabricante, descripcion } = req.body;

        if (!nombre || !marca || !lote || !fabricante) {
            return res.status(400).json({ error: 'Nombre, marca, lote y fabricante son obligatorios' });
        }

        const id = uuidv4().slice(0, 8).toUpperCase();
        const datosBotella = { nombre, marca, lote, fabricante, descripcion: descripcion || '' };

        const blockchain = new BlockChain(datosBotella);
        const qrData = JSON.stringify({ id, nombre, marca, sistema: 'CervezaChain' });
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 2 });

        botellas[id] = {
            blockchain,
            qrDataUrl,
            vendida: false,
            qrInvalidado: false,
            info: datosBotella
        };

        res.json({
            mensaje: 'Botella registrada exitosamente',
            id,
            qrDataUrl,
            bloque: blockchain.chain[0]
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al registrar botella: ' + err.message });
    }
});

// Listar todas las botellas
app.get('/api/botellas', (req, res) => {
    const lista = Object.entries(botellas).map(([id, b]) => ({
        id,
        ...b.info,
        vendida: b.vendida,
        qrInvalidado: b.qrInvalidado,
        bloques: b.blockchain.chain.length
    }));
    res.json(lista);
});

// ===================== ADMINISTRADOR =====================

// Registrar evento de trazabilidad (transporte, mayorista, minorista)
app.post('/api/trazabilidad/:id', (req, res) => {
    const { id } = req.params;
    const { tipo, descripcion, responsable, ubicacion } = req.body;

    const botella = botellas[id];
    if (!botella) {
        return res.status(404).json({ error: 'Botella no encontrada' });
    }

    if (botella.vendida) {
        return res.status(400).json({ error: 'Esta botella ya fue vendida, no se pueden agregar eventos' });
    }

    const tiposPermitidos = ['transporte', 'mayorista', 'minorista'];
    if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo debe ser: transporte, mayorista o minorista' });
    }

    if (!descripcion || !responsable) {
        return res.status(400).json({ error: 'Descripción y responsable son obligatorios' });
    }

    const evento = {
        tipo,
        descripcion,
        responsable,
        ubicacion: ubicacion || '',
        fecha: new Date().toISOString()
    };

    const bloque = botella.blockchain.addBlock(evento);

    res.json({
        mensaje: `Evento de ${tipo} registrado exitosamente`,
        bloque
    });
});

// Consultar historial completo de una botella
app.get('/api/botella/:id/historial', (req, res) => {
    const { id } = req.params;
    const botella = botellas[id];

    if (!botella) {
        return res.status(404).json({ error: 'Botella no encontrada' });
    }

    res.json({
        id,
        info: botella.info,
        vendida: botella.vendida,
        qrInvalidado: botella.qrInvalidado,
        cadenaValida: botella.blockchain.esValida(),
        historial: botella.blockchain.getHistorial()
    });
});

// ===================== CONSUMIDOR =====================

// Verificar autenticidad escaneando QR (por ID)
app.get('/api/verificar/:id', (req, res) => {
    const { id } = req.params;
    const botella = botellas[id];

    if (!botella) {
        return res.json({
            autentica: false,
            mensaje: 'ALERTA: Botella no encontrada en el sistema. Posible fraude.'
        });
    }

    if (botella.qrInvalidado) {
        return res.json({
            autentica: false,
            mensaje: 'ALERTA: Este código QR ya fue utilizado. Posible fraude o botella ya vendida.'
        });
    }

    const cadenaValida = botella.blockchain.esValida();

    res.json({
        autentica: cadenaValida,
        mensaje: cadenaValida
            ? 'Botella auténtica verificada en blockchain'
            : 'ALERTA: La cadena de bloques ha sido alterada. Posible fraude.',
        id,
        info: botella.info,
        vendida: botella.vendida,
        historial: botella.blockchain.getHistorial()
    });
});

// Confirmar compra (marcar como vendida + invalidar QR)
app.post('/api/botella/:id/comprar', (req, res) => {
    const { id } = req.params;
    const { consumidor } = req.body;
    const botella = botellas[id];

    if (!botella) {
        return res.status(404).json({ error: 'Botella no encontrada' });
    }

    if (botella.vendida) {
        return res.status(400).json({ error: 'Esta botella ya fue vendida' });
    }

    if (botella.qrInvalidado) {
        return res.status(400).json({ error: 'El QR de esta botella ya fue invalidado' });
    }

    const eventoVenta = {
        tipo: 'venta',
        consumidor: consumidor || 'Anónimo',
        fecha: new Date().toISOString()
    };

    botella.blockchain.addBlock(eventoVenta);
    botella.vendida = true;
    botella.qrInvalidado = true;

    res.json({
        mensaje: 'Compra confirmada. Botella marcada como vendida y QR invalidado.',
        id
    });
});

// Obtener QR de una botella
app.get('/api/botella/:id/qr', (req, res) => {
    const { id } = req.params;
    const botella = botellas[id];

    if (!botella) {
        return res.status(404).json({ error: 'Botella no encontrada' });
    }

    res.json({ id, qrDataUrl: botella.qrDataUrl, invalidado: botella.qrInvalidado });
});

app.listen(PORT, () => {
    console.log(`CervezaChain corriendo en http://localhost:${PORT}`);
});
