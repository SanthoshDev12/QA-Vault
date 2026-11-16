declare module 'mammoth' {
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer } | { path: string },
    options?: Record<string, unknown>
  ): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;

  export function extractRawText(
    input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer } | { path: string }
  ): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
}
