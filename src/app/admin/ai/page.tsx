import { redirect } from "next/navigation";

/** AI usage moved into Monitoring & evaluation (AI tab); old links keep working. */
export default function AdminAI() {
  redirect("/admin/monitoring?tab=ai");
}
