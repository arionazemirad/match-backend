import bcrypt from "bcrypt";
import { config } from "dotenv";

// Load environment variables
config();

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || "10", 10);

/**
 * Hash a password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verify if a plain text password matches a hashed password
 * @param plainPassword Plain text password
 * @param hashedPassword Hashed password
 * @returns Boolean indicating if passwords match
 */
export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};
