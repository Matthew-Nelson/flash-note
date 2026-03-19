# Cloud SQL PostgreSQL instance (INFRA-05)
resource "google_sql_database_instance" "main" {
  name                = "${local.service_name}-${local.env}"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = var.environment == "production"

  settings {
    tier              = var.db_tier
    availability_type = var.db_availability_type
    disk_autoresize   = true
    disk_size         = 10
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled = true
      # Defense-in-depth for direct connections. Cloud SQL Auth Proxy (used by
      # Cloud Run) encrypts traffic regardless. ssl_mode replaces deprecated
      # require_ssl per Terraform provider guidance.
      ssl_mode = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
      }
    }

    maintenance_window {
      day  = 7
      hour = 5
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  }

  # Encryption at rest is automatic with Google-managed keys -- no explicit config needed.

  depends_on = [google_project_service.apis["sqladmin.googleapis.com"]]
}

resource "google_sql_database" "flashnote" {
  name     = "flashnote"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "flashnote" {
  name     = "flashnote"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = false

  lifecycle {
    ignore_changes = [result]
  }
}
