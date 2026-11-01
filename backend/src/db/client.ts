import { PrismaClient } from "@prisma/client";

// Global PrismaClient instance for PostgreSQL
export const prisma = new PrismaClient();

export async function connectDb() {
  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL via Prisma");
  } catch (err) {
    console.warn("Could not connect to PostgreSQL database directly. In-memory storage available for tests.");
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
}

