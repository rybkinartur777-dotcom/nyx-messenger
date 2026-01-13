// Using Web Crypto API for maximum reliability and zero dependencies
class CryptoService {
    private keyPair: CryptoKeyPair | null = null;

    async init(): Promise<void> {
        // No initialization needed for Web Crypto
    }

    async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
        this.keyPair = await window.crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256",
            },
            true,
            ["deriveKey"]
        );

        const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", this.keyPair.publicKey);
        const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", this.keyPair.privateKey);

        return {
            publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer))),
            privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)))
        };
    }

    async loadKeyPair(publicKeyBase64: string, privateKeyBase64: string): Promise<void> {
        const pubBuffer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
        const pirvBuffer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));

        const publicKey = await window.crypto.subtle.importKey(
            "spki",
            pubBuffer,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            []
        );

        const privateKey = await window.crypto.subtle.importKey(
            "pkcs8",
            pirvBuffer,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey"]
        );

        this.keyPair = { publicKey, privateKey };
    }

    async encryptMessage(message: string, recipientPublicKeyBase64: string): Promise<{ encrypted: string; nonce: string }> {
        if (!this.keyPair) throw new Error('Crypto not ready');

        const recipientPubBuffer = Uint8Array.from(atob(recipientPublicKeyBase64), c => c.charCodeAt(0));
        const recipientKey = await window.crypto.subtle.importKey(
            "spki",
            recipientPubBuffer,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            []
        );

        const sharedSecret = await window.crypto.subtle.deriveKey(
            { name: "ECDH", public: recipientKey },
            this.keyPair.privateKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedMessage = new TextEncoder().encode(message);
        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            sharedSecret,
            encodedMessage
        );

        return {
            encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
            nonce: btoa(String.fromCharCode(...iv))
        };
    }

    async decryptMessage(encryptedBase64: string, nonceBase64: string, senderPublicKeyBase64: string): Promise<string> {
        if (!this.keyPair) throw new Error('Crypto not ready');

        const senderPubBuffer = Uint8Array.from(atob(senderPublicKeyBase64), c => c.charCodeAt(0));
        const senderKey = await window.crypto.subtle.importKey(
            "spki",
            senderPubBuffer,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            []
        );

        const sharedSecret = await window.crypto.subtle.deriveKey(
            { name: "ECDH", public: senderKey },
            this.keyPair.privateKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        const iv = Uint8Array.from(atob(nonceBase64), c => c.charCodeAt(0));
        const encryptedContent = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            sharedSecret,
            encryptedContent
        );

        return new TextDecoder().decode(decryptedContent);
    }

    generateUserId(): string {
        const bytes = window.crypto.getRandomValues(new Uint8Array(8));
        const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let result = 'NYX-';
        for (let i = 0; i < bytes.length; i++) {
            result += base58Chars[bytes[i] % base58Chars.length];
        }
        return result;
    }
}

export const cryptoService = new CryptoService();
