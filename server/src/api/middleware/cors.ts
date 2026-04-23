// CORS middleware configured for the dashboard origin.
// Allows credentials (httpOnly cookies for JWT auth) and standard methods/headers.

import cors from "cors";
import { env } from "../../config/env.js";

export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
