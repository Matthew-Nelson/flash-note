output "wif_provider_name" {
  description = "Full resource name of the WIF provider (used in GitHub secrets for GCP_WORKLOAD_IDENTITY_PROVIDER)"
  value       = google_iam_workload_identity_pool_provider.github_provider.name
}

output "ci_service_account_email" {
  description = "CI/CD service account email (used in GitHub secrets for GCP_SA_EMAIL)"
  value       = google_service_account.ci_deploy.email
}

output "runtime_service_account_email" {
  description = "Cloud Run runtime service account email (used in GitHub secrets for GCP_SA_RUNTIME_EMAIL)"
  value       = google_service_account.cloudrun_runtime.email
}

output "artifact_registry_url" {
  description = "Artifact Registry URL for Docker push"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.flashnote.repository_id}"
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL connection name (for Cloud Run volume mount)"
  value       = google_sql_database_instance.main.connection_name
}

output "cloud_sql_instance_ip" {
  description = "Cloud SQL public IP address (for reference)"
  value       = google_sql_database_instance.main.public_ip_address
}
