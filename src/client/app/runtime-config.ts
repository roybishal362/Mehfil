/**
 * Settings the server decides at runtime (GET /api/config): whether AI runs on Gemini or in
 * demo mode, and the public Firebase web config. One build works with or without them.
 */
import * as z from '../../shared/zod';
import { create } from 'zustand';
import { getJson } from '../lib/api';

export const RuntimeConfig = z.object({
  ai: z.object({ mode: z.enum(['gemini', 'mock']), requiresSignIn: z.boolean() }),
  firebase: z
    .object({
      projectId: z.string(),
      apiKey: z.string(),
      authDomain: z.string(),
      appId: z.string().optional(),
    })
    .nullable(),
  features: z.object({ cloudSync: z.boolean() }),
});
export type RuntimeConfig = z.infer<typeof RuntimeConfig>;

interface ConfigState {
  config: RuntimeConfig | null;
  /** True when the server could not be reached (the app keeps working locally). */
  unreachable: boolean;
}

export const useRuntimeConfig = create<ConfigState>()(() => ({ config: null, unreachable: false }));

let loading: Promise<void> | null = null;

export function loadRuntimeConfig(): Promise<void> {
  loading ??= getJson('/api/config', RuntimeConfig)
    .then((config) => {
      useRuntimeConfig.setState({ config, unreachable: false });
    })
    .catch(() => {
      useRuntimeConfig.setState({ unreachable: true });
    });
  return loading;
}
