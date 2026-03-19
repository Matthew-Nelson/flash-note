# Cloud Run v2 migration job (INFRA-01 job definition)
#
# Runs database migrations using the same Docker image as the app service,
# with an overridden entrypoint that executes the compiled migration script.
#
# The Dockerfile (Plan 01) compiles migrate.ts to migrate.mjs (ESM module)
# and copies it into the runner image at web/src/server/db/migrate.mjs.
# The migration script creates its own pg.Pool from DATABASE_URL only --
# it does not import config.ts and does not need any other app secrets.
#
# Configuration:
# - 5-minute timeout: migrations should complete quickly; long-running
#   migrations indicate a problem that needs manual investigation.
# - 0 retries: migration failures are NOT safe to retry automatically.
#   A partial migration may have applied some DDL statements. Manual
#   investigation is required before re-running.

resource "google_cloud_run_v2_job" "migrate" {
  name     = "${local.service_name}-migrate-${var.environment}"
  location = var.region

  template {
    template {
      service_account = google_service_account.cloudrun_runtime.email
      timeout         = "300s"
      max_retries     = 0

      containers {
        # Placeholder image -- the deploy workflow updates this before each
        # execution via `gcloud run jobs update` with the newly-built image.
        image   = "us-docker.pkg.dev/cloudrun/container/hello:latest"
        command = ["node"]
        args    = ["web/src/server/db/migrate.mjs"]

        # Only DATABASE_URL is needed -- migrate.ts creates its own pg.Pool
        # directly from DATABASE_URL, bypassing config.ts validation.
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app["database-url"].secret_id
              version = "latest"
            }
          }
        }

        # Cloud SQL Auth Proxy volume mount
        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      # Cloud SQL Auth Proxy sidecar (same as service)
      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.main.connection_name]
        }
      }
    }
  }

  # The deploy workflow manages the container image (updates it before
  # each execution). Terraform should not revert to the placeholder.
  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}
