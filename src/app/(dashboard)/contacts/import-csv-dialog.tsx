'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Upload, FileText, Check, AlertCircle } from 'lucide-react'
import { Workflow } from '@/types/database'

interface ImportCsvDialogProps {
  children: React.ReactNode
  workflows: Pick<Workflow, 'id' | 'name' | 'client_id'>[]
}

type ImportStep = 'upload' | 'map' | 'preview' | 'result'

const CONTACT_FIELDS = [
  { value: 'skip', label: "Don't import" },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
]

export function ImportCsvDialog({ children, workflows }: ImportCsvDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ImportStep>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvData, setCsvData] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({})
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null)

  const resetState = () => {
    setStep('upload')
    setError(null)
    setSelectedWorkflow('')
    setCsvHeaders([])
    setCsvData([])
    setColumnMapping({})
    setImportResult(null)
  }

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split(/\r\n|\n/).filter((line) => line.trim())

        if (lines.length < 2) {
          setError('CSV must have at least a header row and one data row')
          return
        }

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = []
          let current = ''
          let inQuotes = false

          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          result.push(current.trim())
          return result
        }

        const headers = parseCSVLine(lines[0])
        const data = lines.slice(1).map(parseCSVLine)

        setCsvHeaders(headers)
        setCsvData(data)

        // Auto-map columns based on header names
        const autoMapping: Record<number, string> = {}
        headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase().replace(/[^a-z]/g, '')
          if (lowerHeader.includes('firstname') || lowerHeader === 'first') {
            autoMapping[index] = 'first_name'
          } else if (lowerHeader.includes('lastname') || lowerHeader === 'last') {
            autoMapping[index] = 'last_name'
          } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('cell')) {
            autoMapping[index] = 'phone'
          } else if (lowerHeader.includes('email')) {
            autoMapping[index] = 'email'
          } else {
            autoMapping[index] = 'skip'
          }
        })
        setColumnMapping(autoMapping)

        setStep('map')
      } catch {
        setError('Failed to parse CSV file')
      }
    }
    reader.readAsText(file)
  }, [])

  const handleImport = async () => {
    setLoading(true)
    setError(null)

    try {
      const contacts = csvData.map((row) => {
        const contact: Record<string, string> = {}
        csvHeaders.forEach((_, index) => {
          const field = columnMapping[index]
          if (field && field !== 'skip' && row[index]) {
            contact[field] = row[index]
          }
        })
        return contact
      }).filter((contact) => contact.phone || contact.email)

      if (contacts.length === 0) {
        setError('No valid contacts found. Each contact needs at least a phone or email.')
        setLoading(false)
        return
      }

      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: selectedWorkflow,
          contacts,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to import contacts')
      }

      const result = await response.json()
      setImportResult(result)
      setStep('result')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const previewContacts = csvData.slice(0, 5).map((row) => {
    const contact: Record<string, string> = {}
    csvHeaders.forEach((_, index) => {
      const field = columnMapping[index]
      if (field && field !== 'skip' && row[index]) {
        contact[field] = row[index]
      }
    })
    return contact
  })

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) resetState()
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a workflow and upload your CSV file'}
            {step === 'map' && 'Map your CSV columns to contact fields'}
            {step === 'preview' && 'Review the contacts before importing'}
            {step === 'result' && 'Import complete'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Workflow</Label>
              <Select
                value={selectedWorkflow}
                onValueChange={setSelectedWorkflow}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a workflow" />
                </SelectTrigger>
                <SelectContent>
                  {workflows.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No workflows available. Create one first.
                    </div>
                  ) : (
                    workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedWorkflow && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drop your CSV file here or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button variant="outline" asChild>
                    <span>Select CSV File</span>
                  </Button>
                </label>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <FileText className="w-4 h-4" />
              {csvData.length} rows found
            </div>

            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Column</TableHead>
                    <TableHead>Map to Field</TableHead>
                    <TableHead>Sample Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map((header, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell>
                        <Select
                          value={columnMapping[index] || 'skip'}
                          onValueChange={(value) =>
                            setColumnMapping({ ...columnMapping, [index]: value })
                          }
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTACT_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {csvData[0]?.[index] || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Preview of first 5 contacts (out of {csvData.length} total):
            </p>

            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewContacts.map((contact, index) => (
                    <TableRow key={index}>
                      <TableCell>{contact.first_name || '-'}</TableCell>
                      <TableCell>{contact.last_name || '-'}</TableCell>
                      <TableCell>{contact.phone || '-'}</TableCell>
                      <TableCell>{contact.email || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'result' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Import Successful
            </h3>
            <p className="text-muted-foreground">
              {importResult?.imported} contacts have been added to the workflow
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}

          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={() => setStep('preview')}>
                Preview Import
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? 'Importing...' : `Import ${csvData.length} Contacts`}
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button onClick={() => setOpen(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
