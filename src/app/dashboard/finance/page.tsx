import { redirect } from 'next/navigation'
import { resolveDashboardDefaultRoute } from '@/lib/dashboard-default-route'

export default async function DashboardFinanceRedirectPage() {
  redirect(await resolveDashboardDefaultRoute('finance'))
}
