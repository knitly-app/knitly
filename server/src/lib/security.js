import { hash, verify } from "@node-rs/argon2";
import crypto from "crypto";

const PASSWORD_HASH_CONFIG = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(password) {
  return hash(password, PASSWORD_HASH_CONFIG);
}

export async function verifyPassword(hash, password) {
  return verify(hash, password);
}

export function generateRandomToken(length) {
  return crypto.randomBytes(length).toString("hex");
}
