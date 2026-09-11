# Campus Mint

Campus Mint is a Next.js application for verified higher-education communities.

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

Copy `.env.example` to a local, ignored environment file and supply the project-specific values. Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_` variable.

## Production integration

- Apply the ordered SQL migrations in `supabase/migrations` to the target Supabase project.
- Enable passwordless email OTP in Supabase Auth and set the email OTP lifetime to 600 seconds with six digits.
- Configure production SMTP in Supabase Auth (for example, a verified Resend SMTP sender); Campus Mint does not call a mail provider from browser code.
- Configure both the browser-safe Supabase URL/publishable key and the server-only URL/service-role key shown in `.env.example`.
- Set `CRON_SECRET` or `CAMPUS_DATA_SYNC_SECRET` for the six-hour verified event refresh route.
- Keep both fixture/developer-control flags false in preview and production.

The application intentionally fails closed when authentication or privileged server configuration is missing. SMS verification and password signup are not part of this release.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
