import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "owner@projectm.local";
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "ChangeThisPassword123!";

  const passwordHash = await argon2.hash(bootstrapPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      firstName: "Paige",
      lastName: "Founder",
      email: ownerEmail,
      passwordHash,
      phone: "+14154830648",
      role: "OWNER",
      passkeyEnabled: false,
      totpEnabled: false
    },
    update: {
      role: "OWNER",
      passwordHash,
      passkeyEnabled: false,
      totpEnabled: false
    }
  });

  const staffRoles = [
    { role: "MANAGER" as const, email: "manager@projectm.local", firstName: "Maya", lastName: "Manager" },
    { role: "MEDIUM" as const, email: "medium@projectm.local", firstName: "Miles", lastName: "Medium" },
    { role: "MONITOR" as const, email: "monitor@projectm.local", firstName: "Mina", lastName: "Monitor" },
    { role: "CLIENT" as const, email: "client@projectm.local", firstName: "Casey", lastName: "Client" }
  ];

  for (const staff of staffRoles) {
    await prisma.user.upsert({
      where: { email: staff.email },
      create: {
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        passwordHash,
        phone: "+14154830648",
        role: staff.role,
        passkeyEnabled: false,
        totpEnabled: false
      },
      update: {
        role: staff.role,
        passwordHash,
        passkeyEnabled: false,
        totpEnabled: false
      }
    });
  }

  const categoryInputs = [
    { name: "TECH", description: "Technology and coding competencies" },
    { name: "BUSINESS", description: "Business logic, operations, and entrepreneurship" },
    { name: "LEGAL", description: "Foundational legal reasoning and civic literacy" },
    { name: "ACADEMIC", description: "Core academic support and study systems" }
  ];

  for (const item of categoryInputs) {
    await prisma.skillCategory.upsert({
      where: { name: item.name },
      create: item,
      update: {}
    });
  }

  const coupons = [
    { code: "WELCOME10", discountType: "PERCENT", value: 10 },
    { code: "PAIGE50", discountType: "AMOUNT", value: 5000 }
  ];

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      create: coupon,
      update: {
        discountType: coupon.discountType,
        value: coupon.value,
        isActive: true
      }
    });
  }

  const hardware = [
    { name: "MacBook Air M2", serialNumber: "PM-MAC-001" },
    { name: "Dell XPS 13", serialNumber: "PM-DEL-001" },
    { name: "iPad Pro", serialNumber: "PM-IPD-001" }
  ];

  for (const device of hardware) {
    await prisma.hardwareInventory.upsert({
      where: { serialNumber: device.serialNumber },
      create: {
        ...device,
        status: "AVAILABLE"
      },
      update: {}
    });
  }

  await prisma.workspacePolicy.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      timezone: "America/Los_Angeles",
      enabled: true
    },
    update: {}
  });

  console.log("Seed complete", {
    ownerId: owner.id,
    ownerEmail
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
