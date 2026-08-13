import { redirect } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user) redirect(302, "/login");
  const orders = await db
    .select()
    .from(schema.order)
    .where(eq(schema.order.userId, event.locals.user.id))
    .orderBy(desc(schema.order.createdAt));
  return { orders };
};
