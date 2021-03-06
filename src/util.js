import mime from "mime/lite";

import { generateRandomString } from "./rand";

const BASE56_ALPHABET =
    "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const DEFAULT_MIME_TYPE = "application/octet-stream";

export function respond(status, msg) {
    return new Response(msg, {
        status: status,
        headers: {
            "Content-Type": "text/plain",
        },
    });
}

export function authToken() {
    return UPLOAD_KEY;
}

export function requireAuthentication(req) {
    const auth = req.headers.get("Authorization");
    if (!auth || auth.trim() !== authToken()) {
        return respond(401, "401 Unauthorized");
    }
}

export function randomID() {
    return generateRandomString(8, BASE56_ALPHABET);
}

// fileExt returns the file extension minus the dot.
export function fileExt(path, mimeType) {
    if (path) {
        const pathSplit = path.split("/");
        const nameSplit = pathSplit[pathSplit.length - 1].split(".");
        if (nameSplit.length > 1) {
            const ext = nameSplit[nameSplit.length - 1].trim().toLowerCase();
            if (ext) {
                return ext;
            }
        }
    }

    if (mimeType) {
        const ext = mime.getExtension(mimeType);
        if (ext) {
            return ext;
        }
    }

    return "";
}

export function guessMimeType(ext) {
    if (ext === "") {
        return DEFAULT_MIME_TYPE;
    }

    const m = mime.getType(ext);
    if (m) {
        return m;
    }

    return DEFAULT_MIME_TYPE;
}

// fileName returns the filename minus the extension.
export function fileName(path) {
    const pathSplit = path.split("/");
    const nameSplit = pathSplit[pathSplit.length - 1].split(".");

    return nameSplit[0];
}
