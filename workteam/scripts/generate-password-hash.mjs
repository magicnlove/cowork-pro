import bcrypt from "bcrypt";

const plainPassword = process.argv[2];
const roundsArg = process.argv[3];
const saltRounds = Number.parseInt(roundsArg ?? "12", 10);

if (!plainPassword) {
  console.error("Usage: npm run hash:password -- <plainPassword> [saltRounds]");
  process.exit(1);
}

if (!Number.isFinite(saltRounds) || saltRounds < 4) {
  console.error("saltRounds must be a number greater than or equal to 4.");
  process.exit(1);
}

try {
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  console.log(hash);
} catch (error) {
  console.error("Failed to generate bcrypt hash.", error);
  process.exit(1);
}
