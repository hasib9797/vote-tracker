const crypto = require("crypto");

function parseSignature(header) {
    if (typeof header !== "string") {
        return null;
    }

    const parts = Object.fromEntries(
        header.split(",").map((part) => {
            const separator = part.indexOf("=");
            return separator === -1
                ? [part.trim(), ""]
                : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
        })
    );

    return parts.t && parts.v1 ? parts : null;
}

function verifyV1Webhook(rawBody, header, secret, toleranceSeconds = 300, now = Date.now()) {
    if (!Buffer.isBuffer(rawBody) || !secret) {
        return false;
    }

    const signature = parseSignature(header);
    if (!signature || !/^\d+$/.test(signature.t) || !/^[a-f\d]{64}$/i.test(signature.v1)) {
        return false;
    }

    const timestamp = Number(signature.t);
    if (
        Number.isFinite(toleranceSeconds)
        && toleranceSeconds >= 0
        && Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds
    ) {
        return false;
    }

    const expected = crypto
        .createHmac("sha256", secret)
        .update(`${signature.t}.`)
        .update(rawBody)
        .digest();
    const received = Buffer.from(signature.v1, "hex");

    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

module.exports = { parseSignature, verifyV1Webhook };
