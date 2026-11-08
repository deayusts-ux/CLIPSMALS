import type { JobState, JobStage } from "./types";

const globalForJobs = globalThis as unknown as {
  __klipviralJobs?: Map<string, JobState>;
};

export const jobs: Map<string, JobState> =
  globalForJobs.__klipviralJobs ?? new Map<string, JobState>();

if (!globalForJobs.__klipviralJobs) globalForJobs.__klipviralJobs = jobs;

export function createJob(id: string): JobState {
  const job: JobState = {
    id,
    stage: "queued",
    progress: 0,
    message: "Queued",
    startedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(
  id: string,
  stage: JobStage,
  progress: number,
  message: string,
  extra?: Partial<JobState>
): void {
  const job = jobs.get(id);
  if (!job) return;
  job.stage = stage;
  job.progress = Math.round(progress);
  job.message = message;
  Object.assign(job, extra);
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}