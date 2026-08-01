import { createAdminClient } from "@insforge/sdk";

const baseUrl = process.env.INSFORGE_API_BASE_URL;
const apiKey = process.env.INSFORGE_API_KEY;

// This client is for trusted server routes only. Never import it from browser code.
export const insforgeAdmin = baseUrl && apiKey
  ? createAdminClient({ baseUrl, apiKey })
  : null;
