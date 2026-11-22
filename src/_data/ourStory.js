import fs from "node:fs";
export default () => JSON.parse(fs.readFileSync("content/our-story.json", "utf8"));
