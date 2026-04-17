import { redirect } from 'next/navigation'
import { resolveDashboardDefaultRoute } from '@/lib/dashboard-default-route'

export default async function DashboardRotativoRedirectPage() {
  redirect(await resolveDashboardDefaultRoute('rotativo'))
}
