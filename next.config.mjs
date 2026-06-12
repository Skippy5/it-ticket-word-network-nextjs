/**
 * Portable Next.js config.
 *
 * The output mode is selected via the NEXT_OUTPUT env var so the same repo
 * supports all three deploy targets without code changes:
 *
 *   (unset)               -> regular server build:  npm run build && npm start  (Vercel / EC2)
 *   NEXT_OUTPUT=standalone -> self-contained server: used by the Dockerfile
 *   NEXT_OUTPUT=export     -> static export to out/: S3+CloudFront / nginx
 *
 * The app is 100% client-side (no API routes, no server components doing data
 * work), so every mode produces an identical, fully functional app.
 */
const output = process.env.NEXT_OUTPUT;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(output === "standalone" || output === "export" ? { output } : {}),
  ...(output === "export" ? { images: { unoptimized: true } } : {}),
};

export default nextConfig;
