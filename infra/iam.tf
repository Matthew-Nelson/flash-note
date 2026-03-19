# -----------------------------------------------------------------------------
# Service Accounts
# -----------------------------------------------------------------------------

resource "google_service_account" "cloudrun_runtime" {
  account_id   = "${local.service_name}-runtime"
  display_name = "FlashNote Cloud Run Runtime"
  description  = "Service account used by Cloud Run service and migration job at runtime"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

resource "google_service_account" "ci_deploy" {
  account_id   = "${local.service_name}-ci-deploy"
  display_name = "FlashNote CI/CD Deploy"
  description  = "Service account used by GitHub Actions for build and deploy operations"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Runtime SA Roles
# -----------------------------------------------------------------------------

# Vertex AI access for LLM (INFRA-04)
resource "google_project_iam_member" "runtime_aiplatform" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloudrun_runtime.email}"

  depends_on = [google_project_service.apis["aiplatform.googleapis.com"]]
}

# Cloud SQL client access
resource "google_project_iam_member" "runtime_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudrun_runtime.email}"

  depends_on = [google_project_service.apis["sqladmin.googleapis.com"]]
}

# Per-secret Secret Manager access (least privilege -- not project-level)
resource "google_secret_manager_secret_iam_member" "runtime_secret_access" {
  for_each = local.secrets

  secret_id = google_secret_manager_secret.app[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun_runtime.email}"
}

# -----------------------------------------------------------------------------
# CI/CD SA Roles
# -----------------------------------------------------------------------------

# Deploy Cloud Run services and revisions
resource "google_project_iam_member" "ci_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

# Execute Cloud Run jobs (migrations)
resource "google_project_iam_member" "ci_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

# Push images to Artifact Registry
resource "google_project_iam_member" "ci_registry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ci_deploy.email}"

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

# Allow CI to deploy Cloud Run services with the runtime SA
resource "google_service_account_iam_member" "ci_impersonate_runtime" {
  service_account_id = google_service_account.cloudrun_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci_deploy.email}"
}

# -----------------------------------------------------------------------------
# Workload Identity Federation (INFRA-07)
# -----------------------------------------------------------------------------

resource "google_iam_workload_identity_pool" "github_actions" {
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "WIF pool for GitHub Actions OIDC authentication"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

resource "google_iam_workload_identity_pool_provider" "github_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Security: Use numeric owner ID instead of string owner name to prevent
  # typosquatting attacks (per research recommendation).
  attribute_condition = "assertion.repository_owner_id == '${var.github_repo_owner_id}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

# Allow the WIF pool to impersonate the CI deploy service account
resource "google_service_account_iam_member" "wif_impersonate_ci" {
  service_account_id = google_service_account.ci_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_actions.name}/attribute.repository/${var.github_repo_owner}/${var.github_repo_name}"
}

# -----------------------------------------------------------------------------
# Cross-Project Artifact Registry Access
# -----------------------------------------------------------------------------

# Grant production runtime SA read access to staging Artifact Registry.
# Applied from the STAGING Terraform config after production infra creates
# the runtime SA. Set prod_runtime_sa_email in staging.tfvars to enable.
resource "google_artifact_registry_repository_iam_member" "prod_pull_from_staging" {
  count = var.prod_runtime_sa_email != "" ? 1 : 0

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.flashnote.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${var.prod_runtime_sa_email}"
}
