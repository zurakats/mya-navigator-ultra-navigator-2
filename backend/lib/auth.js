"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jose_1 = require("jose");
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super-secret-key-for-skripsi-testing');
async function signToken(payload) {
    return await new jose_1.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET);
}
async function verifyToken(token) {
    try {
        const { payload } = await (0, jose_1.jwtVerify)(token, JWT_SECRET);
        return payload;
    }
    catch (err) {
        return null;
    }
}
