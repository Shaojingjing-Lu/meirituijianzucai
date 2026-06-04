import { runAgent } from "./_agent.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
  const result = await runAgent();
  response.status(200).json({
    latestRun: result.latestRun,
    recommendations: result.recommendations
  });
}
