import { redirect, type ActionFunctionArgs } from "react-router";
import { logout } from "~/utils/admin.server";

export async function action({ request }: ActionFunctionArgs) {
  return logout(request, "/");
}

export async function loader() {
 throw redirect("/");
}