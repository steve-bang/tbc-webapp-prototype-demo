import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { INCIDENT_BASELINE_REFERENCES, INCIDENT_SEVERITIES, INCIDENT_TYPES, type IncidentBaselineReference, type IncidentSeverity, type IncidentType } from '@/shared/domain/enums'
import { INCIDENT_BASELINE_REFERENCE_LABELS, INCIDENT_SEVERITY_LABELS, INCIDENT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useStartAssessingIncident } from '../hooks'
import { incidentAssessFormSchema, type Incident, type IncidentAssessFormValues } from '../model'

function defaultValues(incident: Incident): IncidentAssessFormValues {
  return {
    type: incident.type,
    severity: incident.severity,
    safetyImpact: incident.safetyImpact,
    location: incident.location ?? '',
    description: incident.description,
    baselineReference: incident.baselineReference ?? '',
  }
}

/** UC-DI-03/04 — `OPEN -> ASSESSING`, bổ sung/sửa Type/Severity/Safety Impact/Location/Baseline Reference (nếu `source === 'RETURN'`). */
export function IncidentAssessDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const startAssessing = useStartAssessingIncident()
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncidentAssessFormValues>({
    resolver: zodResolver(incidentAssessFormSchema),
    defaultValues: incident ? defaultValues(incident) : undefined,
  })

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && incident) reset(defaultValues(incident))
  }

  async function onSubmit(values: IncidentAssessFormValues) {
    if (!incident) return
    try {
      await startAssessing.mutateAsync({
        id: incident.id,
        input: {
          type: values.type as IncidentType,
          severity: values.severity as IncidentSeverity,
          safetyImpact: values.safetyImpact,
          location: values.location,
          description: values.description,
          baselineReference: (values.baselineReference || undefined) as IncidentBaselineReference | undefined,
        },
      })
      toast.success(vi.incidents.assessSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.assessError)
    }
  }

  const isBusy = startAssessing.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{vi.incidents.assessDialogTitle}</DialogTitle>
        </DialogHeader>

        <form id="incident-assess-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.incidents.typeLabel} *</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {INCIDENT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.incidents.severityLabel} *</Label>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {INCIDENT_SEVERITY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="safetyImpact"
              render={({ field }) => (
                <Checkbox id="ia-safetyImpact" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              )}
            />
            <Label htmlFor="ia-safetyImpact" className="font-normal">
              {vi.incidents.safetyImpactLabel}
            </Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ia-location">{vi.incidents.locationLabel} *</Label>
            <Input id="ia-location" {...register('location')} />
            {errors.location && <p className="text-destructive text-sm">{errors.location.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ia-description">{vi.incidents.descriptionLabel} *</Label>
            <Textarea id="ia-description" rows={3} {...register('description')} />
            {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
          </div>

          {incident?.source === 'RETURN' && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.incidents.baselineReferenceLabel}</Label>
              <Controller
                control={control}
                name="baselineReference"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={vi.incidents.baselineReferenceSelectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_BASELINE_REFERENCES.map((b) => (
                        <SelectItem key={b} value={b}>
                          {INCIDENT_BASELINE_REFERENCE_LABELS[b]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="incident-assess-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
