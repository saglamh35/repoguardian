# repoguardian-worker

This is a standalone worker for handling background jobs.

## Running locally

1.  Make sure you have Redis running. If you are using the `docker-compose.yml` from the root of the repository, it should already be running.
2.  Install dependencies:
    ```bash
    pnpm -C worker install
    ```
3.  Run the worker:
    ```bash
    REDIS_URL=redis://localhost:6379 WORKER_PORT=9100 pnpm -C worker dev
    ```

## Endpoints

-   `GET /health`: Health check
-   `GET /metrics`: Prometheus metrics
-   `POST /enqueue/dummy`: Enqueue a dummy job
-   `GET /job/:id`: Get job status
