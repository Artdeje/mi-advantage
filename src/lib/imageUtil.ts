/**
 * Reads an image file and returns a compact data URL by downscaling through
 * a canvas. Keeps base64 payloads small (a few dozen KB instead of hundreds),
 * which matters because profile pictures / branding logos are stored as base64
 * inside single DB rows and shipped inside every list response.
 *
 * Non-image files (PDFs) and GIFs are returned unchanged so multi-page or
 * animated documents are never broken.
 */
export function readImageAsDataUrl(file: File, maxEdge = 256, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      const reader = new FileReader();
      reader.onload = (ev) => resolve((ev.target?.result as string) || "");
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = (ev.target?.result as string) || "";
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(raw); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
