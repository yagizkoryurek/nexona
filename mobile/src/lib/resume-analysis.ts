import type { DocumentPickerAsset } from 'expo-document-picker';
import { Platform } from 'react-native';

import { postFormToApi, type ApiResult } from '@/lib/api';

/**
 * Calls the web app's Resume Analyzer endpoint with a picked document.
 *
 * The analysis itself happens entirely server-side — see
 * `src/app/api/mobile/resume-analyzer/route.ts` in the web project, which runs
 * the same validation, extraction, rate limiting, Gemini call and persistence
 * as the dashboard action. Nothing about the résumé is interpreted here; this
 * module only gets the file onto that endpoint and types what comes back.
 */

/**
 * Mirrors `ResumeAnalysis` in the web app's `src/lib/ai/resume-analysis.ts`.
 *
 * Declared by hand rather than imported for the same reason as
 * `lib/resume-file.ts`: the root tsconfig excludes `mobile/`, so there is no
 * shared module graph. This is the response contract of one HTTP endpoint, and
 * the endpoint validates against its own Zod schema before replying — so a
 * mismatch here surfaces as a type error on this side, never as bad data
 * reaching the server.
 */
export type ResumeAnalysis = {
  overallScore: number;
  atsScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
};

/**
 * Builds the multipart body.
 *
 * The two platforms need genuinely different values here and this is the one
 * place that difference exists:
 *
 * - On iOS/Android, React Native's `FormData` accepts a `{ uri, name, type }`
 *   descriptor and streams the file off disk itself. There is no `File` object
 *   in that runtime to hand it instead.
 * - On web, `FormData` is the browser's own and requires a real `File`. The
 *   picker supplies one on `asset.file`, so that is used directly rather than
 *   re-wrapping the URI.
 *
 * Getting this backwards fails only at runtime, on one platform, with a server
 * response of "No file was provided" — the route's `file instanceof File` check
 * rejecting a plain object.
 */
function buildFormData(asset: DocumentPickerAsset): FormData | null {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    if (!asset.file) return null;
    formData.append('file', asset.file);
    return formData;
  }

  formData.append('file', {
    uri: asset.uri,
    name: asset.name,
    // The server re-derives the format from the filename extension, so a
    // missing MIME type is not fatal — but multipart parsers want a value.
    type: asset.mimeType ?? 'application/octet-stream',
  } as unknown as Blob);

  return formData;
}

export async function analyzeResume(
  asset: DocumentPickerAsset
): Promise<ApiResult<ResumeAnalysis>> {
  const formData = buildFormData(asset);

  if (!formData) {
    return { error: "We couldn't read that file. Please choose it again." };
  }

  return postFormToApi<ResumeAnalysis>('/api/mobile/resume-analyzer', formData);
}
