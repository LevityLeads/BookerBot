'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { Client, BusinessHours } from '@/types/database'
import { BrandResearchWizard, BrandData } from '@/components/brand-research-wizard'

const TIMEZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

interface EditClientPageProps {
  params: { id: string }
}

export default function EditClientPage({ params }: EditClientPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<Client | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    timezone: 'Europe/London',
    twilio_phone_number: '',
    business_hours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: null,
      sunday: null,
    } as BusinessHours,
  })

  useEffect(() => {
    async function fetchClient() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error || !data) {
        router.push('/clients')
        return
      }

      const clientData = data as Client
      setClient(clientData)
      setFormData({
        name: clientData.name,
        timezone: clientData.timezone,
        twilio_phone_number: clientData.twilio_phone_number || '',
        business_hours: clientData.business_hours as BusinessHours,
      })
      setLoading(false)
    }

    fetchClient()
  }, [params.id, router])

  const handleSaveBrandData = async (brandData: BrandData) => {
    const response = await fetch(`/api/clients/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...brandData,
        brand_researched_at: new Date().toISOString()
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save brand data')
    }

    // Refresh client data
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .single()

    if (data) {
      setClient(data as Client)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/clients/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update client')
      }

      router.push(`/clients/${params.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const updateBusinessHours = (day: keyof BusinessHours, field: 'start' | 'end', value: string) => {
    setFormData((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: prev.business_hours[day]
          ? { ...prev.business_hours[day], [field]: value }
          : { start: '09:00', end: '17:00', [field]: value },
      },
    }))
  }

  const toggleDayOpen = (day: keyof BusinessHours) => {
    setFormData((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: prev.business_hours[day] ? null : { start: '09:00', end: '17:00' },
      },
    }))
  }

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="mb-6">
        <Link
          href={`/clients/${params.id}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Client
        </Link>
      </div>

      {/* Brand Research Section */}
      {client && (
        <BrandResearchWizard client={client} onSave={handleSaveBrandData} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Edit Client</CardTitle>
          <CardDescription>Update client details and business hours</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Brand Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This name will be used in outreach messages
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="twilio_phone_number">Twilio Phone Number</Label>
                <Input
                  id="twilio_phone_number"
                  placeholder="+1234567890"
                  value={formData.twilio_phone_number}
                  onChange={(e) =>
                    setFormData({ ...formData, twilio_phone_number: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label>Business Hours</Label>
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24 capitalize">{day}</div>
                  <Button
                    type="button"
                    variant={formData.business_hours[day] ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleDayOpen(day)}
                  >
                    {formData.business_hours[day] ? 'Open' : 'Closed'}
                  </Button>
                  {formData.business_hours[day] && (
                    <>
                      <Input
                        type="time"
                        className="w-32"
                        value={formData.business_hours[day]?.start || '09:00'}
                        onChange={(e) => updateBusinessHours(day, 'start', e.target.value)}
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        className="w-32"
                        value={formData.business_hours[day]?.end || '17:00'}
                        onChange={(e) => updateBusinessHours(day, 'end', e.target.value)}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
