import { handleCallback } from "../lib/oauth.mjs";

export default (request) => handleCallback(request, process.env);

export const config = { path: "/callback" };
