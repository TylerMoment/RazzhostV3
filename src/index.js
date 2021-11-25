import { handleRequest } from "./http";

addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request));
});
