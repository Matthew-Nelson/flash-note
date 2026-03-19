# Secret Manager secret shells (INFRA-06)
# Secret VALUES are set via gcloud or Console, never in Terraform.

locals {
  secrets = toset([
    "database-url",
    "upstash-redis-rest-url",
    "upstash-redis-rest-token",
    "resend-api-key",
    "stripe-secret-key",
    "stripe-webhook-secret",
    "stripe-price-monthly",
    "stripe-price-annual",
    "cleanup-secret",
  ])
}

resource "google_secret_manager_secret" "app" {
  for_each  = local.secrets
  secret_id = each.key

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

# Auto-generate DATABASE_URL with the correct socket path format for
# Cloud SQL Auth Proxy (unix socket, not TCP).
resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.app["database-url"].id
  secret_data = "postgresql://${google_sql_user.flashnote.name}:${random_password.db_password.result}@/${google_sql_database.flashnote.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
}
