import type { APIRoute } from 'astro';

// Interface for Cloudflare environment with R2 binding
interface Env {
  BLOG_CONTENT: {
    list: (options?: any) => Promise<any>;
  };
}

interface UploadedFile {
  key: string;
  originalName: string;
  size: number;
  uploaded: string;
  contentType: string;
  url: string;
}

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    // Get R2 bucket from Cloudflare runtime
    const env = (locals as any).runtime?.env as Env;
    if (!env?.BLOG_CONTENT) {
      return new Response(JSON.stringify({ error: "R2 bucket not available" }), { 
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    // Get pagination parameters
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const cursor = url.searchParams.get('cursor') || undefined;

    // Get list of files from uploads folder
    const listResult = await env.BLOG_CONTENT.list({
      prefix: 'uploads/',
      limit: limit,
      cursor: cursor
    });

    if (!listResult || !listResult.objects) {
      return new Response(JSON.stringify({ 
        files: [], 
        truncated: false,
        cursor: null 
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

  // Transform R2 objects to convenient format
  const files: UploadedFile[] = listResult.objects.map((obj: any) => {
    // Extract timestamp and original name from key
    const keyParts = obj.key.split('/').pop(); // Get filename part
    let uploadedDate = new Date().toISOString();
    let originalName = 'Unknown';

    if (keyParts) {
      // Try to parse: timestamp-hash-originalname (new format)
      let match = keyParts.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-([a-f0-9]{8})-(.+)$/);
      if (match) {
        const [, timestamp, hash, filename] = match;
        // Convert timestamp back to ISO format
        uploadedDate = timestamp.replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z/, '$1-$2-$3T$4:$5:$6.$7Z');
        originalName = filename.replace(/_/g, ' '); // Convert underscores back to spaces
      } else {
        // Try to parse: timestamp-longhash-originalname (old format)
        match = keyParts.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-([a-f0-9-]{36})-(.+)$/);
        if (match) {
          const [, timestamp, hash, filename] = match;
          uploadedDate = timestamp.replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})T(\d{2}):(\d{2}):(\d{2}):(\d{3})Z/, '$1-$2-$3T$4:$5:$6.$7Z');
          originalName = filename.replace(/_/g, ' ');
        } else {
          // Fallback: use filename as-is for manually uploaded files
          originalName = keyParts;
          // Try to extract date from R2 object metadata if available
          if (obj.uploaded || obj.lastModified) {
            uploadedDate = obj.uploaded || obj.lastModified;
          }
        }
      }
    }

    // Fallback to customMetadata if available
    if (obj.customMetadata?.originalName) {
      originalName = obj.customMetadata.originalName;
    }
    if (obj.customMetadata?.uploadedAt) {
      uploadedDate = obj.customMetadata.uploadedAt;
    }

    return {
      key: obj.key,
      originalName: originalName,
      size: obj.size || 0,
      uploaded: uploadedDate,
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      url: `/api/file/${obj.key}`
    };
  });

    // Sort by upload date (newest first)
    files.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

    return new Response(JSON.stringify({
      files,
      truncated: listResult.truncated || false,
      cursor: listResult.cursor || null,
      total: files.length
    }), {
      status: 200,
      headers: { 
        "content-type": "application/json",
        "cache-control": "public, max-age=60" // Cache for one minute
      }
    });

  } catch (error: any) {
    console.error("Files list error:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || "Failed to list files" 
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
