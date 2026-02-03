import type { LoaderFunction } from "react-router";
import { getAdminSession } from "~/utils/admin.server";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const admin = await getAdminSession(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    return Response.json({ success: true, data: admin }, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: "User not found", success: false, data: null },
      { status: 400 }
    );
  }
};