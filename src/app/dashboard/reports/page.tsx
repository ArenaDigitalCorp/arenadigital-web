import { redirect } from 'next/navigation'
import { resolveDashboardDefaultRoute } from '@/lib/dashboard-default-route'

export default async function ReportsRedirectPage() {
  redirect(await resolveDashboardDefaultRoute('reports'))
}
