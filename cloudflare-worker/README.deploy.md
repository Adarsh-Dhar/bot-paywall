Deploy helper notes

- Use `./set_api_url_and_deploy.sh <PUBLIC_API_URL>` to set a public API URL (for example from ngrok or an externally deployed main app) and deploy the worker.
- Example: `./set_api_url_and_deploy.sh https://abcd-1234.eu.ngrok.io`
- The helper updates `.env` with `API_BASE_URL` and calls `deploy_with_env.sh`, which will set secrets and write [vars] into `wrangler.toml` before running `npx wrangler deploy`.

Security note: Use a public URL only for testing. For production, deploy the main app to a secure public endpoint and set `API_BASE_URL` to that endpoint. Keep the `WORKER_API_KEY` secret in your environment and as a worker secret.
