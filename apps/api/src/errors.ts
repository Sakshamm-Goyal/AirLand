/** Fastify reads `statusCode` off thrown errors and replies with it. */
export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (why = 'Not allowed') => new HttpError(403, why);
