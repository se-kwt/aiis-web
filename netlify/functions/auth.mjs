import { handleAuth } from "../lib/oauth.mjs";

export default (request) => handleAuth(request, process.env);

export const config = { path: "/auth" };
