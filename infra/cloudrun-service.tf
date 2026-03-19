# Cloud Run v2 service (INFRA-06 completion)
#
# The application runs as a Cloud Run service with:
# - All 9 runtime secrets mounted from Secret Manager as env vars
# - Cloud SQL Auth Proxy sidecar for encrypted database connections
# - Ingress restricted to internal-load-balancer (all traffic via ALB)
#
# DEPLOY_VERSION is NOT set here -- it changes on every deploy and is passed
# via `gcloud run deploy --set-env-vars=DEPLOY_VERSION=$SHA` in the deploy
# workflow. All other env vars are stable across deploys.

resource "google_cloud_run_v2_service" "flashnote" {
  name     = "${local.service_name}-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.cloudrun_runtime.email

    scaling {
      min_instance_count = var.cloudrun_min_instances
      max_instance_count = var.cloudrun_max_instances
    }

    containers {
      # Placeholder image -- the deploy workflow overrides this on every deploy.
      # Terraform just needs a valid initial image for the first apply.
      image = "us-docker.pkg.dev/cloudrun/container/hello:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          memory = var.cloudrun_memory
          cpu    = var.cloudrun_cpu
        }
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/api/health"
        }
        timeout_seconds = 3
        period_seconds  = 30
      }

      # -----------------------------------------------------------------
      # Non-secret environment variables (set directly)
      # -----------------------------------------------------------------

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "WEB_URL"
        value = "https://${var.domain}"
      }

      env {
        name  = "LLM_PROVIDER"
        value = "gemini"
      }

      env {
        name  = "GEMINI_USE_ADC"
        value = "true"
      }

      env {
        name  = "GEMINI_API_URL"
        value = "https://${var.region}-aiplatform.googleapis.com/v1/projects/${var.project_id}/locations/${var.region}/publishers/google"
      }

      env {
        name  = "GEMINI_MODEL"
        value = "gemini-2.5-flash"
      }

      env {
        name  = "TRUSTED_PROXY_COUNT"
        value = "2"
      }

      env {
        name  = "REGISTRATION_MODE"
        value = "invite"
      }

      # -----------------------------------------------------------------
      # Secret environment variables (mounted from Secret Manager)
      # -----------------------------------------------------------------

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["database-url"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "UPSTASH_REDIS_REST_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["upstash-redis-rest-url"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "UPSTASH_REDIS_REST_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["upstash-redis-rest-token"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "RESEND_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["resend-api-key"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["stripe-secret-key"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_WEBHOOK_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["stripe-webhook-secret"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_PRICE_MONTHLY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["stripe-price-monthly"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_PRICE_ANNUAL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["stripe-price-annual"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "CLEANUP_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["cleanup-secret"].secret_id
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

    # Cloud SQL Auth Proxy sidecar -- provides encrypted tunnel to Cloud SQL
    # instance via Unix socket at /cloudsql/{connection_name}.
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }
  }

  # The deploy workflow manages the container image (updates it on every
  # deploy). Terraform should not revert to the placeholder image on apply.
  # client and client_version are set by gcloud and change on every deploy.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}
