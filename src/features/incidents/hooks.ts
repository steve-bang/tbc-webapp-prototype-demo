import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type {
  ActorInfo,
  IncidentAssessInput,
  IncidentCreateInput,
  IncidentFilter,
  IncidentLiabilityInput,
  IncidentMarkRepairedInput,
  IncidentStartRepairInput,
} from './api'

/** Mirror `rentals/hooks.ts`/`contracts/hooks.ts` — fallback khi mất session là `OPERATION_STAFF` (quyền thấp nhất). */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useIncidents(filter?: IncidentFilter) {
  return useQuery({
    queryKey: ['incidents', filter ?? {}],
    queryFn: () => api.list(filter),
  })
}

export function useIncident(id?: string) {
  return useQuery({
    queryKey: ['incidents', 'detail', id],
    queryFn: () => api.getById(id as string),
    enabled: !!id,
  })
}

function invalidateIncident(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['incidents'] })
  queryClient.invalidateQueries({ queryKey: ['incidents', 'detail', id] })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: IncidentCreateInput) => api.create(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  })
}

export function useCreateIncidentFromReturn() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({
      returnRecordId,
      itemId,
      severity,
      safetyImpact,
    }: {
      returnRecordId: string
      itemId: string
      severity: IncidentCreateInput['severity']
      safetyImpact: boolean
    }) => api.createFromReturnIncidentItem(returnRecordId, itemId, { severity, safetyImpact }, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  })
}

export function useStartAssessingIncident() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IncidentAssessInput }) => api.startAssessing(id, input, actor),
    onSuccess: (_data, variables) => invalidateIncident(queryClient, variables.id),
  })
}

export function useSetIncidentLiability() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IncidentLiabilityInput }) => api.setLiabilityAndCost(id, input, actor),
    onSuccess: (_data, variables) => invalidateIncident(queryClient, variables.id),
  })
}

export function useApproveIncident() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.approve(id, actor),
    onSuccess: (_data, id) => invalidateIncident(queryClient, id),
  })
}

export function useStartIncidentRepair() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IncidentStartRepairInput }) => api.startRepair(id, input, actor),
    onSuccess: (_data, variables) => invalidateIncident(queryClient, variables.id),
  })
}

export function useMarkIncidentRepaired() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IncidentMarkRepairedInput }) => api.markRepaired(id, input, actor),
    onSuccess: (_data, variables) => invalidateIncident(queryClient, variables.id),
  })
}

export function useCloseIncident() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.close(id, actor),
    onSuccess: (_data, id) => invalidateIncident(queryClient, id),
  })
}

export function useCancelIncident() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.cancel(id, reason, actor),
    onSuccess: (_data, variables) => invalidateIncident(queryClient, variables.id),
  })
}
