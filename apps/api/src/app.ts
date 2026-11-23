import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { config } from './config.ts';
import { sql } from './db/client.ts';
import { createRealtime } from './realtime/index.ts';
import { authRoutes } from './routes/auth.ts';
import { conversationRoutes } from './routes/conversations.ts';
import { listingRoutes } from './routes/listings.ts';
import { uploadRoutes } from './routes/uploads.ts';

export async function buildApp() {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: 'info',
            transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
            redact: ['req.headers.authorization'],
          },
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // One error shape for the client: { error, fields? }
  app.setErrorHandler((err: Error & { statusCode?: number; validation?: { instancePath?: string; message?: string }[] }, req, reply) => {
    if (err.validation) {
      const fields = Object.fromEntries(
        err.validation.map((v) => [v.instancePath?.replace(/^\//, '').replace(/\//g, '.') || '_', v.message]),
      );
      return reply.code(400).send({ error: 'Please fix the highlighted fields', fields });
    }
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  const origins = config.CORS_ORIGINS === '*' ? true : config.CORS_ORIGINS.split(',');
  await app.register(helmet);
  await app.register(cors, { origin: origins });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  await app.register(multipart);
  await app.register(swagger, {
    openapi: {
      info: { title: 'LandConnect API', version: '0.1.0' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    },
    transform: jsonSchemaTransform,
  });

  app.get('/health', async () => {
    await sql`select 1`;
    return { ok: true };
  });
  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  await app.register(authRoutes);
  await app.register(listingRoutes);
  await app.register(conversationRoutes);
  await app.register(uploadRoutes);

  const io = createRealtime(app.server, origins === true ? '*' : origins);
  app.addHook('onClose', async () => {
    await io.close();
  });
  return app;
}
