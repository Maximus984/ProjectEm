import { PrismaClient, type UserRole } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

const STAFF_ROLES: UserRole[] = [
  "OWNER",
  "MANAGER",
  "MEDIUM",
  "MONITOR",
  "ADMIN",
  "MENTOR"
];

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const temporaryPassword =
    readArg("--password") ??
    process.env.STAFF_TEMP_PASSWORD ??
    "ProjectMStaff2026!";

  if (temporaryPassword.length < 10) {
    throw new Error("Temporary password must be at least 10 characters.");
  }

  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.user.updateMany({
    where: {
      role: { in: STAFF_ROLES },
      deletedAt: null,
      isActive: true
    },
    data: {
      passwordHash,
      totpEnabled: false,
      totpSecret: null,
      passkeyEnabled: false
    }
  });

  const staffUsers = await prisma.user.findMany({
    where: {
      role: { in: STAFF_ROLES },
      deletedAt: null,
      isActive: true
    },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      role: true
    },
    orderBy: [{ role: "asc" }, { email: "asc" }]
  });

  if (!staffUsers.length) {
    console.log("No active staff accounts found.");
    return;
  }

  console.log("Staff login reset complete.");
  console.log(`Temporary password for all listed staff: ${temporaryPassword}`);
  console.log("");
  console.log("Role | Name | Email");
  console.log("--- | --- | ---");
  for (const user of staffUsers) {
    console.log(
      `${user.role} | ${user.firstName} ${user.lastName} | ${user.email}`
    );
  }
  console.log("");
  console.log("2FA and passkeys were disabled for these accounts.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
