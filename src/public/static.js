import { Base64Binary } from "../b64";

// index.html assets.
import indexHtml from "./index.html";
import styleCss from "./style.css";
import vineBoom from "./vine-boom.mp3";
import razzGif from "./Help_Razz.gif";

// dashboard.html assets.
import dashboardHtml from "./dashboard.html";

export function serveStatic(data) {
    return new Response(Base64Binary.decode(data.contents), {
        status: 200,
        headers: data.headers,
    });
}

export const files = {
    "/index.html": {
        contents: indexHtml,
        headers: {
            "Content-Type": "text/html; charset=UTF-8",
        },
    },
    "/style.css": {
        contents: styleCss,
        headers: {
            "Content-Type": "text/css",
        },
    },
    "/vine-boom.mp3": {
        contents: vineBoom,
        headers: {
            "Content-Type": "audio/mpeg",
        },
    },
    "/Help_Razz.gif": {
        contents: razzGif,
        headers: {
            "Content-Type": "image/gif",
        },
    },
    "/dashboard.html": {
        contents: dashboardHtml,
        headers: {
            "Content-Type": "text/html; charset=UTF-8",
        },
    },
};
