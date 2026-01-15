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

  const [formData, setFormData] = useState({
    name: '',
    brand_name: '',
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
      setFormData({
        name: clientData.name,
        brand_name: clientData.brand_name,
        timezone: clientData.timezone,
        twilio_phone_number: clientData.twilio_phone_number || '',
        business_hours: clientData.business_hours as BusinessHours,
      })
      setLoading(false)
    }

    fetchClient()
  }, [params.id, router])

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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/clients/${params.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Client
        </Link>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Edit Client</CardTitle>
          <CardDescription>Update client details and business hours</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-foreground">Client Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="brand_name" className="text-foreground">Brand Name</Label>
                <Input
                  id="brand_name"
                  value={formData.brand_name}
                  onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                  required
                  className="bg-secondary border-border text-foreground"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timezone" className="text-foreground">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="twilio_phone_number" className="text-foreground">Twilio Phone Number</Label>
                <Input
                  id="twilio_phone_number"
                  placeholder="+1234567890"
                  value={formData.twilio_phone_number}
                  onChange={(e) =>
                    setFormData({ ...formData, twilio_phone_number: e.target.value })
                  }
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-foreground">Business Hours</Label>
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-24 capitalize text-foreground">{day}</div>
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
                        className="w-32 bg-secondary border-border text-foreground"
                        value={formData.business_hours[day]?.start || '09:00'}
                        onChange={(e) => updateBusinessHours(day, 'start', e.target.value)}
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        className="w-32 bg-secondary border-border text-foreground"
                        value={formData.business_hours[day]?.end || '17:00'}
                        onChange={(e) => updateBusinessHours(day, 'end', e.target.value)}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded">{error}</div>
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
