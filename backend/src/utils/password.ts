import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** bcrypt hash for passwords and referenceIds. */
export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
