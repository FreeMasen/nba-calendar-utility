import * as https from "node:https";
import * as http from "node:http";

/**
 * Minimal fetch using Node's built-in http/https modules.
 * Avoids the node-fetch dependency while providing a familiar interface.
 * Supports custom headers (needed for NBA/WNBA CDN which blocks non-browser UAs).
 *
 * @param {string} url
 * @param {{ headers?: object, method?: string }} [options]
 * @returns {Promise<{ ok: boolean, status: number, statusText: string, json: () => Promise<any>, text: () => Promise<string> }>}
 */
export function fetch(url, options = {}) {
    const mod = url.startsWith("https") ? https : http;
    const headers = options.headers ?? {};

    return new Promise((resolve, reject) => {
        const req = mod.request(url, { method: options.method ?? "GET", headers }, (res) => {
            const ok = res.statusCode >= 200 && res.statusCode < 300;
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", () => {
                const body = Buffer.concat(chunks).toString("utf-8");
                resolve({
                    ok,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    json: () => Promise.resolve(JSON.parse(body)),
                    text: () => Promise.resolve(body),
                });
            });
        });
        req.on("error", reject);
        req.end();
    });
}
