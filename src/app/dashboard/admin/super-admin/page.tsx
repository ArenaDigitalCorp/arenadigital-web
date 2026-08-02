import { redirect } from 'next/navigation'
export default async function SuperAdminPage() {
  redirect('/admin/overview')
}
