import { redirect, type RequestHandler } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";

export const POST: RequestHandler = async (event) => {
  await auth.api.signOut({ headers: event.request.headers });
  redirect(302, "/login");
};
