import type { APIRoute } from 'astro';

// Interface for Cloudflare environment with R2 binding
interface Env {
  BLOG_CONTENT: {
    put: (key: string, value: any, options?: any) => Promise<any>;
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Get R2 bucket from Cloudflare runtime
    const env = (locals as any).runtime?.env as Env;
    if (!env?.BLOG_CONTENT) {
      return new Response(JSON.stringify({ error: "R2 bucket not available" }), { 
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    // Parse multipart form data
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Field 'file' is required" }), { 
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // Basic file validation
    const maxBytes = 20 * 1024 * 1024; // 20 MB
    if (file.size === 0) {
      return new Response(JSON.stringify({ error: "File is empty" }), { 
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    if (file.size > maxBytes) {
      return new Response(JSON.stringify({ error: "File too large (>20MB)" }), { 
        status: 413,
        headers: { "content-type": "application/json" }
      });
    }

    // Generate safe filename with timestamp and UUID
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const uuid = crypto.randomUUID();
    const key = `uploads/${timestamp}-${uuid}-${safeName}`;

    // Write file to R2 with proper metadata
    await env.BLOG_CONTENT.put(key, file.stream(), {
      httpMetadata: { 
        contentType: file.type || "application/octet-stream" 
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        size: file.size.toString()
      }
    });

    // Return successful result with file key
    return new Response(JSON.stringify({ 
      ok: true, 
      key,
      originalName: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || "Upload failed" 
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
