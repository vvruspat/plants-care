export const PHOTO_BUCKET = "plant-photos";

export function photoPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
