import { z } from 'zod';

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().default('postgres://lc:lc@localhost:5433/landconnect'),
    JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-dev-only-secret'),
    /** Public base URL of this API, used to build upload URLs. */
    PUBLIC_URL: z.string().default('http://localhost:4000'),
    CORS_ORIGINS: z.string().default('*'),
    LIVEKIT_URL: z.string().default('ws://localhost:7880'),
    LIVEKIT_API_KEY: z.string().default('devkey'),
    LIVEKIT_API_SECRET: z.string().default('secret'),
    RING_TIMEOUT_MS: z.coerce.number().default(30_000),
    /** e.g. smtps://user:pass@smtp-relay.brevo.com:465. Unset in development = local Mailpit on :1025. */
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default('LandConnect <no-reply@landconnect.app>'),
  })
  .parse(process.env);

if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('dev-only')) {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = env;
