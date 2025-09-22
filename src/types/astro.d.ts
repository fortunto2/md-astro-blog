declare namespace App {
  interface Locals {
    cloudflare?: {
      env?: {
        BLOG_CONTENT?: R2Bucket;
        VECTOR_INDEX?: VectorizeIndex;
        AI?: Ai;
      };
    };
    runtime?: {
      env?: {
        BLOG_CONTENT?: R2Bucket;
        VECTOR_INDEX?: VectorizeIndex;
        AI?: Ai;
      };
    };
  }
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

interface R2Object {
  key: string;
  value: ReadableStream;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  checksums: R2Checksums;
}

interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

interface R2Checksums {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
}

interface VectorizeIndex {
  query(vector: number[], options?: VectorizeQueryOptions): Promise<VectorizeMatches>;
  insert(vectors: VectorizeVector[]): Promise<VectorizeAsyncMutation>;
  upsert(vectors: VectorizeVector[]): Promise<VectorizeAsyncMutation>;
}

interface VectorizeQueryOptions {
  topK?: number;
  namespace?: string;
  filter?: Record<string, any>;
  returnMetadata?: boolean;
  returnValues?: boolean;
}

interface VectorizeMatches {
  matches: VectorizeMatch[];
  count: number;
}

interface VectorizeMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, any>;
}

interface VectorizeVector {
  id: string;
  values: number[];
  namespace?: string;
  metadata?: Record<string, any>;
}

interface VectorizeAsyncMutation {
  ids: string[];
  count: number;
}

interface Ai {
  run(model: string, input: any): Promise<any>;
}