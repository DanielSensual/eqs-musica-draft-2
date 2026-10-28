#!/usr/bin/env node
/**
 * Makes the ADMIN_PINS value for /admin/: one random 6-digit PIN per person, stored only as a scrypt hash.
 *
 *   node tools/admin-pin.mjs derek:Derek victor:Victor hector:Hector daniel:Daniel
 *
 * Prints JSON with { env, pins }: `env` is the ADMIN_PINS value for Vercel, `pins` the plain PINs to hand out.
 * Keep the plain PINs out of git (the repo's .env.local is gitignored).
 */

import { randomBytes, randomInt, scryptSync } from "node:crypto";

const people = process.argv.slice(2).map((arg) => {
  const [id, name] = arg.split(":");
  return { id, name: name || id };
});
if (!people.length || people.some((p) => !/^[a-z0-9-]+$/.test(p.id))) {
  console.error("usage: node tools/admin-pin.mjs id:Name [id:Name …]");
  process.exit(1);
}

const pins = {};
const used = new Set();
const env = people.map(({ id, name }) => {
  let pin;
  do pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  while (used.has(pin));
  used.add(pin);
  pins[id] = pin;
  const salt = randomBytes(16);
  return { id, name, hash: `${salt.toString("hex")}:${scryptSync(pin, salt, 32).toString("hex")}` };
});

console.log(JSON.stringify({ env: JSON.stringify(env), pins }));
