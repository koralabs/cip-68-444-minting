import CSL from '@emurgo/cardano-serialization-lib-nodejs';

const HARDENED_OFFSET = 0x80000000;

export class PublicKey {
    constructor(private readonly publicKey: CSL.PublicKey) {}

    toBytes(): Buffer {
        return Buffer.from(this.publicKey.as_bytes());
    }

    hash(): Buffer {
        return Buffer.from(this.publicKey.hash().to_bytes());
    }

    verify(signature: Buffer, data: Buffer) {
        return this.publicKey.verify(data, CSL.Ed25519Signature.from_bytes(signature));
    }
}

export class PrivateKey {
    constructor(private readonly privateKey: CSL.PrivateKey) {}

    toBytes(): Buffer {
        return Buffer.from(this.privateKey.as_bytes());
    }

    toPublicKey(): PublicKey {
        return new PublicKey(this.privateKey.to_public());
    }

    sign(data: Buffer): Buffer {
        return Buffer.from(this.privateKey.sign(data).to_bytes());
    }

    verify(signature: Buffer, message: Buffer) {
        return this.privateKey.to_public().verify(message, CSL.Ed25519Signature.from_bytes(signature));
    }
}

export class Bip32PrivateKey {
    private readonly bip32PrivateKey: CSL.Bip32PrivateKey;

    constructor(xprv: Buffer) {
        this.bip32PrivateKey = CSL.Bip32PrivateKey.from_bytes(xprv);
    }

    static async fromEntropy(entropy: Buffer): Promise<Bip32PrivateKey> {
        return new Bip32PrivateKey(Buffer.from(CSL.Bip32PrivateKey.from_bip39_entropy(entropy, Buffer.alloc(0)).as_bytes()));
    }

    derive(index: number): Bip32PrivateKey {
        return new Bip32PrivateKey(Buffer.from(this.bip32PrivateKey.derive(index).as_bytes()));
    }

    deriveHardened(index: number): Bip32PrivateKey {
        return this.derive(index + HARDENED_OFFSET);
    }

    toBytes(): Buffer {
        return Buffer.from(this.bip32PrivateKey.as_bytes());
    }

    toPrivateKey(): PrivateKey {
        return new PrivateKey(this.bip32PrivateKey.to_raw_key());
    }
}
