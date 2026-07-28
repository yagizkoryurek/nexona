// mammoth ships no types of its own and there's no @types/mammoth package —
// this covers only the one function this codebase calls.
declare module "mammoth" {
  type ExtractRawTextResult = {
    value: string;
    messages: unknown[];
  };

  export function extractRawText(input: {
    buffer: Buffer;
  }): Promise<ExtractRawTextResult>;
}
