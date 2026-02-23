import assert from 'node:assert';
import { describe, it } from 'node:test';

import { mnemonicToEntropy } from 'bip39';

import { Bip32PrivateKey } from './bip32Ed25519Compat';

const seedPhrase = 'hurdle exile essence fitness winter unaware coil polar vocal like tuition story consider weasel shove donkey effort nice any buffalo trip amount hundred duty';
const expectedRootKeyHex = '78a1810e87ee336f5249abb5e00e42c2114ae7953dd10774c06507f8ab2c8a4f37ee475ad8b7fb253da165489b58630e303873dd2f56f93d4933bcfe521efd7678955fa23cf9047e201c0b988db6655f51dc65635438be059df6830709af49eb';
const expectedRootPublicKeyHex = '49793e0a3e94e30a851830e00c8722dedf63e508f8f25e6f7603a8e85a7f1eb3';
const expectedRootSignatureHex = 'ab5e8d90639217ade3b2d4a7e43282062062f44556df7fb627a8bd01c06ec4278ae4f735063e0a0d8829a30995d936219467a3e37136bcd798e04479c20b150a';
const expectedPublicKeyHex = 'c37bcbeb366dfa9244f5a6702ce4787831a3fb33910169dd06d3ee4ffca04ffa';
const expectedPublicKeyHashHex = 'b32d73a127613965d793ad6f7455a9373fb17ae604a24378f4aba455';
const expectedSignatureHex = 'b212a4387fdfe80d74aea2b26fcce475ad7206e0aef10ed5a02369bffcfb4db843973e10d1eb2d099faa92d5225bb0d777cd4453b4fc0d62ec806e5be7ab4702';

describe('bip32Ed25519Compat', () => {
    it('derives deterministic payment keys and signatures from mnemonic entropy', async () => {
        const entropy = Buffer.from(mnemonicToEntropy(seedPhrase), 'hex');
        const rootKey = await Bip32PrivateKey.fromEntropy(entropy);
        const privateKey = rootKey
            .derive(0x80000000 + 1852)
            .derive(0x80000000 + 1815)
            .derive(0x80000000)
            .derive(0)
            .derive(0)
            .toPrivateKey();

        assert.strictEqual(rootKey.toBytes().toString('hex'), expectedRootKeyHex);
        assert.strictEqual(privateKey.toPublicKey().toBytes().toString('hex'), expectedPublicKeyHex);
        assert.strictEqual(privateKey.toPublicKey().hash().toString('hex'), expectedPublicKeyHashHex);
        assert.strictEqual(privateKey.sign(Buffer.from('abcd', 'hex')).toString('hex'), expectedSignatureHex);
    });

    it('loads a bip32 private key from xprv bytes', () => {
        const privateKey = new Bip32PrivateKey(Buffer.from(expectedRootKeyHex, 'hex')).toPrivateKey();

        assert.strictEqual(privateKey.toPublicKey().toBytes().toString('hex'), expectedRootPublicKeyHex);
        assert.strictEqual(privateKey.sign(Buffer.from('abcd', 'hex')).toString('hex'), expectedRootSignatureHex);
    });
});
