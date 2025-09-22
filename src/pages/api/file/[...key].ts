import type { APIRoute } from 'astro';

// Interface for Cloudflare environment with R2 binding
interface Env {
  BLOG_CONTENT: {
    get: (key: string) => Promise<any>;
  };
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    // Get R2 bucket from Cloudflare runtime
    const env = (locals as any).runtime?.env as Env;
    if (!env?.BLOG_CONTENT) {
      return new Response("R2 bucket not available", { status: 500 });
    }

    // Construct key from path parameters
    const key = Array.isArray(params.key) ? params.key.join("/") : params.key;
    if (!key) {
      return new Response("Key required", { status: 400 });
    }

    // Verify key starts with "uploads/" for security
    if (!key.startsWith("uploads/")) {
      return new Response("Access denied", { status: 403 });
    }

    // Get object from R2
    const obj = await env.BLOG_CONTENT.get(key);
    if (!obj) {
      return new Response("File not found", { status: 404 });
    }

    // Set response headers
    const headers = new Headers();
    if (obj.httpMetadata?.contentType) {
      headers.set("content-type", obj.httpMetadata.contentType);
    }
    if (obj.size != null) {
      headers.set("content-length", String(obj.size));
    }

    // Add Cache-Control for optimization
    headers.set("cache-control", "public, max-age=31536000"); // 1 год

    // Return file as stream
    return new Response(obj.body, { status: 200, headers });

  } catch (error: any) {
    console.error("File download error:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
