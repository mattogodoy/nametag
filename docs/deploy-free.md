# Free Hosting Guide (Vercel + Supabase)

If you don't want to manage a Docker container on a VPS, you can host Nametag completely for free using Vercel (for the app) and Supabase (for the database). Both offer generous free tiers that are perfect for personal use.

Here's how to get it running.

## Prerequisites
* **GitHub Account**: You'll need to fork the repo.
* **Vercel Account**: Free tier is fine.
* **Supabase Account**: Free tier is fine.

## 1. Set up the Database (Supabase)
First, we need a PostgreSQL database.

1.  Create a new project on [Supabase](https://supabase.com/).
2.  Go to **Project Settings** (the gear icon) → **Database**.
3.  Find the **Connection String** section and switch to **URI**.
4.  Copy the connection string.
    *   It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.project.supabase.co:5432/postgres`
    *   *Note: You'll need the password you just set when creating the project.*

## 2. Deploy to Vercel
Now let's get the app online.

1.  **Fork** the [Nametag repository](https://github.com/mattogodoy/nametag) to your own GitHub account.
2.  Log in to [Vercel](https://vercel.com/) and add a **New Project**.
3.  Import your forked Nametag repo.
4.  **Important Configuration Steps:**
    *   **Framework Preset:** Leave as Next.js.
    *   **Build Command:** You need to override this to ensure the database migrations run during deployment.
        *   Toggle **Override** and paste this:
            ```bash
            npx prisma generate && npx prisma migrate deploy && next build
            ```
    *   **Environment Variables:** Add these keys:

    | Name | Value | Notes |
    | :--- | :--- | :--- |
    | `DATABASE_URL` | `postgresql://...` | The URI from Supabase (Step 1). |
    | `NEXTAUTH_SECRET` | `...` | Generate a random string (e.g. `openssl rand -base64 32`). |
    | `NEXTAUTH_URL` | `http://localhost:3000` | **Temp placeholder.** We'll fix this after the first deploy. |
    | `CRON_SECRET` | `...` | Pick a random password (e.g., `mySecretKey123`). Used for cron jobs. |
    | `DISABLE_REGISTRATION` | `false` | Keep false so you can sign up. |

5.  Hit **Deploy**.
    *   *Don't panic if the deploy succeeds but the app shows an error or you can't log in yet. We still need to fix the URL.*

## 3. Fix the URL & Redeploy
1.  On your Vercel Project Dashboard, grab your new domain (e.g., `https://nametag-steve.vercel.app`).
2.  Go to **Settings** → **Environment Variables**.
3.  Edit `NEXTAUTH_URL` and replace `http://localhost:3000` with your actual Vercel domain.
4.  Go to the **Deployments** tab.
5.  Click the three dots on the latest deployment and choose **Redeploy**.

Once this finishes, you should be able to visit your URL and create your account!

## 4. Post-Install Security
Since this is on the public web, you probably don't want strangers signing up.

1.  Create your account first.
2.  Go back to Vercel Environment Variables.
3.  Set `DISABLE_REGISTRATION` to `true`.
4.  **Redeploy** one last time.

Now only you can access it.

## 5. Setting up Reminders (Cron Jobs)
Vercel's free tier doesn't natively schedule cron jobs for us in the way the Docker setup does, so we need an external trigger.

1.  Use a free service like [cron-job.org](https://cron-job.org/).
2.  Create a job that runs daily (e.g., 9:00 AM).
3.  **URL:** `https://your-app.vercel.app/api/cron/send-reminders`
4.  **Headers:** Add `Authorization` with value `Bearer [YOUR_CRON_SECRET]`.

## A Few Things to Note
*   **Cold Starts:** On the free tier, Vercel puts the app to sleep if no one visits it for a while. The first click of the day might take a few seconds to load.
*   **Supabase Pausing:** Supabase pauses free databases after a week of inactivity. If your app stops working, just log in to the Supabase dashboard to "wake it up".
