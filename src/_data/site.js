import fs from "node:fs";
export default () => JSON.parse(fs.readFileSync("content/site.json", "utf8"));
