import { redirect } from 'next/navigation'
import { resolveDashboardDefaultRoute } from '@/lib/dashboard-default-route'

export default async function DashboardStationsRedirectPage() {
  redirect(await resolveDashboardDefaultRoute('stations'))
}
