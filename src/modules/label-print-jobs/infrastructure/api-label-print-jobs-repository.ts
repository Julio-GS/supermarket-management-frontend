import { apiRequest } from "@/shared/infrastructure/api-client"
import type {
  ClaimAllForPrintOptions,
  ClaimedLabelJobsSequence,
  CreateLabelJobInput,
  LabelPrintJobsPort,
} from "../application/label-print-jobs-port"
import { isValidSalePrice, type RemoteLabelJob } from "../domain/remote-label-job"

const BASE_PATH = "/label-print-jobs"
const DEFAULT_CLAIM_PAGE_LIMIT = 45
const MAX_CLAIM_PAGE_LIMIT = 45

interface ClaimContinueWireResponse {
  jobs: RemoteLabelJob[]
  next_cursor: string | null
  has_more: boolean
}

interface ClaimContinuePageParams {
  cursor: string | null
  limit: number
  leaseSeconds?: number
}

export class ApiLabelPrintJobsRepository implements LabelPrintJobsPort {
  async getPendingJobs(): Promise<RemoteLabelJob[]> {
    return apiRequest<RemoteLabelJob[]>(`${BASE_PATH}/pending`)
  }

  async claim(installationId: string, leaseMs: number): Promise<RemoteLabelJob | null> {
    return apiRequest<RemoteLabelJob | null>(`${BASE_PATH}/claim`, {
      method: "POST",
      body: JSON.stringify({
        installation: installationId,
        lease_ms: leaseMs,
      }),
    })
  }

  async claimBatch(installationId: string, leaseMs: number, limit: number): Promise<RemoteLabelJob[]> {
    return apiRequest<RemoteLabelJob[]>(`${BASE_PATH}/claim-batch`, {
      method: "POST",
      body: JSON.stringify({
        installation: installationId,
        lease_ms: leaseMs,
        limit,
      }),
    })
  }

  async claimAllForPrint(
    installationId: string,
    options: ClaimAllForPrintOptions
  ): Promise<ClaimedLabelJobsSequence> {
    const limit = options.limit ?? DEFAULT_CLAIM_PAGE_LIMIT
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CLAIM_PAGE_LIMIT) {
      throw new Error(`El límite de página de claim debe estar entre 1 y ${MAX_CLAIM_PAGE_LIMIT}.`)
    }

    const jobs: RemoteLabelJob[] = []
    const seenIds = new Set<string>()
    let cursor: string | null = null

    // First page carries the lease; continuation pages only carry the opaque cursor.
    let page = await this.claimContinuePage(installationId, {
      cursor,
      limit,
      leaseSeconds: options.leaseSeconds,
    })

    while (true) {
      for (const job of page.jobs) {
        this.validateClaimedJob(job)
        if (seenIds.has(job.id)) {
          throw new Error("La API devolvió un trabajo duplicado durante la continuación del claim.")
        }
        seenIds.add(job.id)
        jobs.push(job)
      }

      if (!page.has_more) break

      if (!page.next_cursor || page.next_cursor.trim() === "") {
        throw new Error("La API indicó más páginas pendientes pero no devolvió next_cursor.")
      }

      cursor = page.next_cursor
      page = await this.claimContinuePage(installationId, { cursor, limit })
    }

    return { jobs }
  }

  async createJob(input: CreateLabelJobInput): Promise<RemoteLabelJob> {
    const body: Record<string, unknown> = {
      product_id: input.product_id,
      sku: input.sku,
      product_name: input.product_name,
      sale_price: input.sale_price,
    }
    if (input.idempotency_key) {
      body.idempotency_key = input.idempotency_key
    }
    return apiRequest<RemoteLabelJob>(`${BASE_PATH}`, {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async completeJob(jobId: string, installationId: string): Promise<void> {
    await apiRequest<void>(`${BASE_PATH}/${jobId}/complete`, {
      method: "POST",
      body: JSON.stringify({ installation: installationId }),
    })
  }

  async failJob(jobId: string, installationId: string, reason: string): Promise<void> {
    await apiRequest<void>(`${BASE_PATH}/${jobId}/fail`, {
      method: "POST",
      body: JSON.stringify({ installation: installationId, reason }),
    })
  }

  async blockJob(jobId: string, installationId: string, reason: string): Promise<RemoteLabelJob> {
    return apiRequest<RemoteLabelJob>(`${BASE_PATH}/${jobId}/block`, {
      method: "POST",
      body: JSON.stringify({ installation: installationId, reason }),
    })
  }

  private async claimContinuePage(
    installationId: string,
    params: ClaimContinuePageParams
  ): Promise<ClaimContinueWireResponse> {
    const body: Record<string, unknown> = {
      installation: installationId,
      limit: params.limit,
    }
    if (params.cursor !== null) {
      body.cursor = params.cursor
    }
    if (params.leaseSeconds !== undefined) {
      body.lease_seconds = params.leaseSeconds
    }

    const raw = await apiRequest<unknown>(`${BASE_PATH}/claim-batch/continue`, {
      method: "POST",
      body: JSON.stringify(body),
    })

    return this.parseClaimContinueResponse(raw)
  }

  private parseClaimContinueResponse(raw: unknown): ClaimContinueWireResponse {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("Respuesta inválida del claim continuado.")
    }
    const record = raw as Record<string, unknown>
    if (!Array.isArray(record.jobs) || typeof record.has_more !== "boolean") {
      throw new Error("Respuesta inválida del claim continuado.")
    }
    const nextCursor = record.next_cursor
    if (
      nextCursor !== null &&
      nextCursor !== undefined &&
      typeof nextCursor !== "string"
    ) {
      throw new Error("Respuesta inválida del claim continuado.")
    }
    return {
      jobs: record.jobs as RemoteLabelJob[],
      next_cursor: (nextCursor as string | null) ?? null,
      has_more: record.has_more as boolean,
    }
  }

  private validateClaimedJob(job: RemoteLabelJob): void {
    if (
      typeof job !== "object" ||
      job === null ||
      typeof job.id !== "string" ||
      job.id.trim() === "" ||
      typeof job.product_id !== "string" ||
      typeof job.sku !== "string" ||
      typeof job.product_name !== "string" ||
      typeof job.sale_price !== "string" ||
      !isValidSalePrice(job.sale_price)
    ) {
      throw new Error("La API devolvió un trabajo de etiqueta inválido.")
    }
  }
}
