import { Router } from "itty-router";

import { files, serveStatic } from "./public/static";
import {
    fileExt,
    fileName,
    guessMimeType,
    randomID,
    requireAuthentication,
    respond,
} from "./util";

const defaultExpirationTtl = DEFAULT_EXPIRATION * 7 * 24 * 60 * 60; // convert from weeks to seconds
const router = Router();

// rewrites contains any in-process URL rewrites. The client is not redirected.
const rewrites = {
    "/": "/index.html",
    "/dashboard": "/dashboard.html",
};

// globalHeaders are applied to every response.
const globalHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
};

// noCacheHeaders are applied to responses that should not be cached.
const noCacheHeaders = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
};

// profile.webp redirects to Razz's current Discord avatar. The avatar URL is
// cached in KV.
router.get("/profile.webp", async (req) => {
    const profileKey = "---profile---";

    let url = await db.get(profileKey);
    if (!url) {
        const discordReq = new Request(
            `https://discord.com/api/v9/users/${DISCORD_USER_ID}`,
            {
                headers: {
                    Authorization: `Bot ${DISCORD_TOKEN}`,
                },
                method: "GET",
            }
        );

        const res = await fetch(discordReq);
        const body = await res.text();
        const data = JSON.parse(body);
        url = `https://cdn.discordapp.com/avatars/${DISCORD_USER_ID}/${data.avatar}.webp?size=128`;

        await db.put(profileKey, url, {
            metadata: {
                mime: "text/plain",
                ext: "webp",
                created_at: Math.round(new Date().getTime() / 1000),
            },
            expirationTtl: 10 * 60, // 10 minutes
        });
    }

    return new Response(null, {
        status: 302,
        headers: {
            Location: url,
        },
    });
});

router.get("/manifest", async (req) => {
    const manifest = {
        Version: "1.0.0",
        Name: `RazzhostV3 Uploader`,
        DestinationType: "ImageUploader, FileUploader",
        RequestMethod: "POST",
        RequestURL: `https://${req.xurl.hostname}/upload`,
        Headers: {
            Authorization: "INSERT_AUTH_KEY_HERE",
            "X-File-Name": "$filename$",
        },
        Body: "Binary",
        URL: "$json:url$",
        ThumbnailURL: "$json:url$",
    };

    return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
});

router.post("/upload", requireAuthentication, async (req) => {
    const name = req.headers.get("X-File-Name"),
        forceName = req.headers.get("X-Force-Name"),
        customExpiry = parseInt(req.headers.get("X-Expiry-Seconds"));

    // Process forced filename.
    let id = randomID(),
        mime = req.headers.get("Content-Type"),
        ext = fileExt(name, mime);
    if (forceName) {
        id = fileName(forceName);
        ext = fileExt(forceName, mime);
    }

    // Guess mime-type.
    if (!mime) {
        mime = guessMimeType(ext);
    }

    let expirationTtl = defaultExpirationTtl;
    if (customExpiry < 0) {
        // Negative is default.
        expirationTtl = defaultExpirationTtl;
    } else if (customExpiry === 0) {
        // 0 is never.
        expirationTtl = undefined;
    } else if (!isNaN(customExpiry)) {
        // Positive values are a custom value.
        expirationTtl = customExpiry;
    }
    if (expirationTtl !== undefined && expirationTtl < 60) {
        // CloudFlare's minimum TTL is 60 seconds.
        expirationTtl = 60;
    }

    const metadata = {
        mime,
        ext,
        created_at: Math.round(new Date().getTime() / 1000),
    };
    await db.put(id, req.body, {
        metadata,
        expirationTtl,
    });

    const res = {
        url: `https://${req.xurl.hostname}/${id}${ext ? "." + ext : ""}`,
        name: id,
        expiration: metadata.created_at + expirationTtl,
        metadata,
    };
    return new Response(JSON.stringify(res), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            ...noCacheHeaders,
        },
    });
});

router.get("/dashboard/list", requireAuthentication, async (req) => {
    const cursor = req.xurl.searchParams.get("cursor") || null;
    const limit = req.xurl.searchParams.get("limit") || 100;

    const data = await db.list({
        cursor,
        limit,
    });

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            ...noCacheHeaders,
        },
    });
});

router.delete("/dashboard/delete", requireAuthentication, async (req) => {
    let key = req.xurl.searchParams.get("key");
    if (!key) {
        return respond(
            400,
            '400 Bad Request: "key" query parameter is required'
        );
    }

    key = fileName(key);
    const file = await db.get(key, { type: "stream" });
    if (!file) {
        return respond(404, `404 Not Found: no file with key "${key}" exists`);
    }

    await db.delete(key);

    return new Response(null, {
        status: 204, // No Content
        ...noCacheHeaders,
    });
});

// 404 handler. Serves rewrites, static files and KV files.
router.all("*", async (req) => {
    let path = req.xurl.pathname;
    if (path !== "/") {
        path = path.replace(/\/$/, "");
    }

    // Handle rewrites.
    if (!req.rewritten && rewrites.hasOwnProperty(path)) {
        req.xurl.pathname = rewrites[path];
        req.url = req.xurl.toString();
        req.rewritten = true;
        return router.handle(req);
    }

    // Handle static files.
    if (files.hasOwnProperty(path)) {
        return serveStatic(files[path]);
    }

    // Serve files from KV.
    const file = await db.getWithMetadata(fileName(path), { type: "stream" });
    if (file && file.value) {
        return new Response(file.value, {
            status: 200,
            headers: {
                "Content-Type":
                    file.metadata.mime || "application/octet-stream",
            },
        });
    }

    return respond(404, "404 Not Found");
});

export async function handleRequest(req) {
    req.xurl = new URL(req.url);

    const res = await router.handle(req);
    for (const [k, v] of Object.entries(globalHeaders)) {
        res.headers.set(k, v);
    }

    return res;
}
