# Deploying Nametag for Free (Vercel + Supabase)

This guide explains how to deploy Nametag for free using Vercel (for the application) and Supabase (for the database). This is an alternative to the self-hosted Docker setup.

## Prerequisites
* A [GitHub](https://github.com/) account.
* A [Vercel](https://vercel.com/) account (free tier).
* A [Supabase](https://supabase.com/) account (free tier).

## Step 1: Database Setup (Supabase)
1.  Create a new project on Supabase.
2.  Once created, go to **Project Settings** (gear icon) -> **Database**.
3.  Under **Connection String**, select **URI**.
4.  Copy the connection string. It will look like this:
    `postgresql://postgres:[YOUR-PASSWORD]@db.project.supabase.co:5432/postgres`
    *(Keep this safe; you will need it in Step 2).*

## Step 2: Vercel Deployment
1.  Fork the [Nametag repository](https://github.com/mattogodoy/nametag) to your GitHub account.
2.  Log in to Vercel and click **Add New...** -> **Project**.
3.  Select your forked Nametag repository.
4.  **Configure the Project:**
    * **Framework Preset:** Next.js (should be auto-detected).
    * **Build Command:** You **must** override this to ensure the database schema is created. Toggle "Override" and enter:
        ```bash
        npx prisma generate && npx prisma migrate deploy && next build
        ```
    * **Environment Variables:** Add the following:

    | Name | Value | Description |
    | :--- | :--- | :--- |
    | `DATABASE_URL` | `postgresql://...` | The URI you copied from Supabase in Step 1. |
    | `NEXTAUTH_SECRET` | `(random 32+ char string)` | Generate using `openssl rand -base64 32` or a password generator. |
    | `NEXTAUTH_URL` | `http://localhost:3000` | **Temporary placeholder.** We will update this after the first deployment. |
    | `CRON_SECRET` | `(random string)` | A secret key for protecting scheduled tasks (e.g., `mySecretKey123`). |
    | `DISABLE_REGISTRATION` | `false` | Keep `false` initially to create your admin account. |

5.  Click **Deploy**.
    * *Note: The initial deployment might show an error or the login won't work because the URL is not configured yet. This is expected.*

## Step 3: Final Configuration
1.  Once the deployment finishes (pass or fail), go to your Vercel Project Dashboard.
2.  Copy your specific domain (e.g., `https://nametag-yourname.vercel.app`).
3.  Go to **Settings** -> **Environment Variables**.
4.  Edit `NEXTAUTH_URL` and replace the localhost value with your actual Vercel domain (e.g., `https://nametag-yourname.vercel.app`).
5.  Go to the **Deployments** tab, find the latest deployment, click the **three dots**, and select **Redeploy**.

## Step 4: Post-Install
1.  Visit your URL and create your account.
2.  (Optional) To prevent others from registering, go back to Vercel Environment Variables, set `DISABLE_REGISTRATION` to `true`, and redeploy.

## Step 5: Setting up Reminders (Cron)
Nametag uses Cron jobs to send reminders. Vercel does not automatically run these without configuration.
1.  Use a free service like **[cron-job.org](https://cron-job.org/)**.
2.  Create a new job to run daily (e.g., at 9:00 AM).
3.  **URL:** `https://your-app.vercel.app/api/cron/send-reminders`
4.  **Headers:** You must add an authorization header:
    * Key: `Authorization`
    * Value: `Bearer [YOUR_CRON_SECRET]` (The secret you set in Step 2).

## Caveats of Free Tier
* **Cold Starts:** Vercel puts free apps to sleep when not in use. The first load might take a few seconds.
* **Database Pausing:** Supabase pauses projects after inactivity (usually 1 week). You may need to log in to Supabase to "wake up" the database if you haven't used the app in a while.
