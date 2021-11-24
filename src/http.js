import { Router } from "itty-router";

import { files, serveStatic } from "./public/static";
import {
    fileExt,
    fileName,
    randomID,
    requireAuthentication,
    respond
} from "./util";

const expirationTtl = DEFAULT_EXPIRATION * 7 * 24 * 60 * 60; // convert from weeks to seconds
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

// profile.webp redirects to Razz's current Discord avatar. The avatar URL is
// cached in KV.
router.get("/profile.webp", async (req) => {
    const profileKey = "profile";

    let url = await db.get(profileKey);
    if (!url) {
        const discordReq= new Request(`https://discord.com/api/v9/users/${DISCORD_USER_ID}`, {
            headers: {
                "Authorization": `Bot ${DISCORD_TOKEN}`,
            },
            method: "GET",
        });

        const res = await fetch(discordReq);
        const body = await res.text();
        const data = JSON.parse(body);
        url = `https://cdn.discordapp.com/avatars/${DISCORD_USER_ID}/${data.avatar}.webp?size=128`;

        await db.put(profileKey, url, {
            metadata: {
                mime: "text/plain",
                ext: "webp",
            },
            expirationTtl: 10 * 60, // 10 minutes
        });
    }

    return new Response(null, {
        status: 302,
        headers: {
            "Location": url,
        },
    });
});

router.get("/manifest",  async (req) => {
    const manifest = {
        Version: "1.0.0",
        Name: `RazzhostV3 Uploader`,
        DestinationType: "ImageUploader, FileUploader",
        RequestMethod: "POST",
        RequestURL: `https://${req.xurl.hostname}/upload`,
        Headers: {
          "Authorization": "INSERT_AUTH_KEY_HERE",
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
}),

router.post("/upload", requireAuthentication, async (req) => {
    const
        id = randomID(),
        mime = req.headers.get("Content-Type"),
        name = req.headers.get("X-File-Name"),
        ext = fileExt(name, mime);

    await db.put(id, req.body, {
        metadata: {
            mime,
            ext
        },
        expirationTtl,
    });

    return new Response(`{"url":"https://${req.xurl.hostname}/${id}.${ext}"}`, {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
});

router.get("/dashboard/list", requireAuthentication, async (req) => {
    const cursor = req.xurl.searchParams.get("cursor") || null;
    const limit = req.xurl.searchParams.get("limit") || 100;

    const items = await db.list({
        cursor,
        limit
    });

    return new Response(JSON.stringify(items), {
        status: 200,
    });
});

router.delete("/dashboard/delete", requireAuthentication, async (req) => {
    const key = req.xurl.searchParams.get("key");

    await db.delete(key);

    return new Response(null, {
        status: 204, // No Content
    });
});

// 404 handler. Serves rewrites, static files and KV files.
router.all("*", async (req) => {
    let path = req.xurl.pathname
    if (path !== "/") {
        path = path.replace(/\/$/, "");
    }

    // Handle rewrites.
    if (!req.rewritten && rewrites.hasOwnProperty(path)) {
        req.xurl.pathname = rewrites[path];
        req.url = req.xurl.toString()
        req.rewritten = true;
        return router.handle(req);
    }

    // Handle static files.
    if (files.hasOwnProperty(path)) {
        return serveStatic(files[path]);
    }

    // Serve files from KV.
    const file = await db.getWithMetadata(fileName(path), {
        type: "stream",
    });
    if (file.value) {
        return new Response(file.value, {
            status: 200,
            headers: {
                "Content-Type": file.metadata.mime || "application/octet-stream",
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
};
