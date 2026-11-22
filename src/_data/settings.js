import fs from "node:fs";
export default () => JSON.parse(fs.readFileSync("content/settings.json", "utf8"));
