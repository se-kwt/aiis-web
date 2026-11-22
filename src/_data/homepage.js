import fs from "node:fs";
export default () => JSON.parse(fs.readFileSync("content/homepage.json", "utf8"));
