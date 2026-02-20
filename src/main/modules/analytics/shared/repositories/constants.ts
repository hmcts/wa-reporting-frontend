import { Prisma } from '@prisma/client';

export const SECONDS_PER_DAY_SQL = Prisma.sql`EXTRACT(EPOCH FROM INTERVAL '1 day')`;
