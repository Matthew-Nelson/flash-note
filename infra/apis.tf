locals {
  required_apis = toset([
    "run.googleapis.com",                  # Cloud Run
    "sqladmin.googleapis.com",             # Cloud SQL Admin
    "secretmanager.googleapis.com",        # Secret Manager
    "artifactregistry.googleapis.com",     # Artifact Registry
    "aiplatform.googleapis.com",           # Vertex AI
    "iam.googleapis.com",                  # IAM
    "iamcredentials.googleapis.com",       # IAM Credentials (WIF token exchange)
    "compute.googleapis.com",             # Load Balancer (used by Plan 03)
    "certificatemanager.googleapis.com",  # SSL certificates (used by Plan 03)
  ])
}

resource "google_project_service" "apis" {
  for_each = local.required_apis

  project = var.project_id
  service = each.key

  disable_dependent_services = false
  disable_on_destroy         = false
}
