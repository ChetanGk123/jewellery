This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker

A production image is defined by the [`Dockerfile`](Dockerfile) (multi-stage,
Bun + Next.js `output: "standalone"`, non-root runtime, ~360 MB).

The two `NEXT_PUBLIC_*` Supabase values are inlined into the browser bundle at
**build** time, so they must be passed as build args. `SUPABASE_SECRET_KEY` is a
server-only secret passed at **run** time.

```bash
# Build + run in one step (reads .env.local; set the two NEXT_PUBLIC_* vars in
# your shell or a .env file so Compose can pass them as build args):
export $(grep -E '^NEXT_PUBLIC_' .env.local | xargs)
docker compose up --build

# Or with plain docker:
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -t jr-jewellers:latest .
docker run --rm -p 3000:3000 --env-file .env.local jr-jewellers:latest
```

Then open [http://localhost:3000](http://localhost:3000).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
