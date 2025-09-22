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

  // Transliterate function for Cyrillic and other non-latin characters
  function transliterate(text: string): string {
    const cyrillicMap: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
      'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
      'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
      'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };

    return text
      .split('')
      .map(char => cyrillicMap[char] || char)
      .join('')
      .replace(/[^\w.\-\s]+/g, '') // Remove special chars but keep spaces
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  }

  // Generate safe filename with timestamp and short hash
  const safeName = transliterate(file.name);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const shortHash = crypto.randomUUID().slice(0, 8); // Short 8-char hash
  const key = `uploads/${timestamp}-${shortHash}-${safeName}`;

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
