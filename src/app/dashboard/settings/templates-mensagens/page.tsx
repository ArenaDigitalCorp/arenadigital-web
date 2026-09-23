import { redirect } from 'next/navigation'
import { resolveDashboardDefaultRoute } from '@/lib/dashboard-default-route'

export default async function DashboardTemplatesMensagensRedirectPage() {
  redirect(await resolveDashboardDefaultRoute('templates-mensagens'))
}
