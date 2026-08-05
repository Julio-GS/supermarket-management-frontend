import { ApiLabelPrintJobsRepository } from "./api-label-print-jobs-repository"

/** Singleton API repository for remote label print jobs. */
export const labelPrintJobsRepository = new ApiLabelPrintJobsRepository()
