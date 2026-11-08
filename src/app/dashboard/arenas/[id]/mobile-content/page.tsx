import { redirect } from 'next/navigation'
export default async function LegacyMobileContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/publications/${id}`)
}
