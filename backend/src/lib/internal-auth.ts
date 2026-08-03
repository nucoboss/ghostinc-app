import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { config } from "../config.js";

export function hasInternalAccess(request: FastifyRequest) {
  const provided = request.headers["x-internal-token"];
  if (typeof provided !== "string") return false;
  const expectedBuffer = Buffer.from(config.internalServiceToken);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function internalRateKey(request: FastifyRequest) {
  return typeof request.headers["x-client-ip"] === "string"
    ? request.headers["x-client-ip"]
    : request.ip;
}
