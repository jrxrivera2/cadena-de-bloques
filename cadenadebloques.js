const SHA256 = require('crypto-js/sha256');

class Block {
    constructor(index, data, previoHash = '') {
        this.index = index;
        this.timestamp = new Date().toISOString();//tiempo y hora en que se crea
        this.data = data;//la informacion del evento
        this.previoHash = previoHash; //hash del bloque anterior
        this.hash = this.createHash();//huella unica calculada con SHA256
    }
    //Metodo que toma la informacion del bloque
    createHash() {//funcion para calcular el hash del bloque
        return SHA256(
            this.index + this.timestamp + JSON.stringify(this.data) + this.previoHash
        ).toString();//hash calculado con SHA256
    }
}

class BlockChain {
    constructor(datosBotella) {
        this.chain = [this.crearBloqueGenesis(datosBotella)];
    }
    //Metodo que crea el bloque genesis
    crearBloqueGenesis(datosBotella) {
        return new Block(0, {
            tipo: 'registro',
            ...datosBotella,
            fecha: new Date().toISOString()
        });
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }
    //Metodo que agrega un nuevo bloque a la cadena
    addBlock(data) {
        const prevBlock = this.getLastBlock();
        const block = new Block(prevBlock.index + 1, data, prevBlock.hash);
        this.chain.push(block);
        return block;
    }
    //Recorre la cadena de bloques y verifica que la cadena se altero
    esValida() {
        for (let i = 1; i < this.chain.length; i++) {
            const actual = this.chain[i];
            const anterior = this.chain[i - 1];

            const hashRecalculado = new Block(
                actual.index, actual.data, actual.previoHash
            );

            if (actual.previoHash !== anterior.hash) {
                return false;
            }
        }
        return true;
    }
    //Muestra los datos de la cadena de bloques
    //Cada bloque apunta al anterior mediante su hash haciendo que cualquier modificacion sea detectable
    getHistorial() {
        return this.chain.map(block => ({
            index: block.index,
            tipo: block.data.tipo,
            data: block.data,
            hash: block.hash,
            previoHash: block.previoHash,
            timestamp: block.timestamp
        }));
    }
}

module.exports = { Block, BlockChain };
