import { runAgent } from "./_agent.js";

export default async function handler(request, response) {
  if (request.method !== "POST" && request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(await runAgent());
}
