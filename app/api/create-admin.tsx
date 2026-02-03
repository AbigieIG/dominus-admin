import type { ActionFunction } from "react-router";
import { AdminService, requireAdminSession } from "~/utils/admin.server";

export const action: ActionFunction = async ({ request }) => {

  // const formData = await request.formData();
  // const name = formData.get("name") as string;
  // const email = formData.get("email") as string;
  // const password = formData.get("password") as string;

    const body = await request.json();
    const { name, email, password, contact } = body;
 
  try {
        const admin = await requireAdminSession(request);
    if (admin) {
      return Response.json({ error: "Unauthorized", success: false }, { status: 401 });
    }
    if (!name || !email || !password) {
      return Response.json({ 
        error: "All fields are required", 
        success: false 
      }, { status: 400 });
    }

    const result = await AdminService.createAdmin({ name, email, password, contact });
    
    return Response.json({ 
      admin: result.toJSON(),
      success: true,
      message: "Admin created successfully"
    }, { status: 201 });

  } catch (error) {
    return Response.json({ 
      error: error instanceof Error ? error.message : "Failed to create", 
      success: false 
    }, { status: 400 });
  }
}
