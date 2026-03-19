# Global External Application Load Balancer (INFRA-08)
#
# Routes HTTPS traffic to Cloud Run via a serverless NEG, with a
# Google-managed SSL certificate for the custom domain. HTTP traffic
# is redirected to HTTPS via a separate URL map and forwarding rule.
#
# Resource dependency chain:
#   Global IP -> Forwarding Rule -> HTTPS Proxy -> URL Map -> Backend Service -> NEG -> Cloud Run
#   Global IP -> Forwarding Rule -> HTTP Proxy  -> Redirect URL Map (HTTP-to-HTTPS)

# -----------------------------------------------------------------------------
# Static Global IP
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "default" {
  name = "${local.service_name}-ip-${var.environment}"

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Serverless NEG -> Cloud Run
# -----------------------------------------------------------------------------

resource "google_compute_region_network_endpoint_group" "cloudrun_neg" {
  name                  = "${local.service_name}-neg-${var.environment}"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.flashnote.name
  }

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Backend Service
# -----------------------------------------------------------------------------

resource "google_compute_backend_service" "default" {
  name                  = "${local.service_name}-backend-${var.environment}"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.cloudrun_neg.id
  }

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# URL Map (HTTPS)
# -----------------------------------------------------------------------------

resource "google_compute_url_map" "default" {
  name            = "${local.service_name}-urlmap-${var.environment}"
  default_service = google_compute_backend_service.default.id

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Google-Managed SSL Certificate
# -----------------------------------------------------------------------------

resource "google_compute_managed_ssl_certificate" "default" {
  name = "${local.service_name}-cert-${var.environment}"

  managed {
    domains = [var.domain]
  }

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# HTTPS Proxy + Forwarding Rule (port 443)
# -----------------------------------------------------------------------------

resource "google_compute_target_https_proxy" "default" {
  name             = "${local.service_name}-https-proxy-${var.environment}"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${local.service_name}-https-${var.environment}"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_https_proxy.default.id
  ip_address            = google_compute_global_address.default.id
  port_range            = "443"

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# HTTP-to-HTTPS Redirect (port 80)
# -----------------------------------------------------------------------------

resource "google_compute_url_map" "http_redirect" {
  name = "${local.service_name}-http-redirect-${var.environment}"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "${local.service_name}-http-proxy-${var.environment}"
  url_map = google_compute_url_map.http_redirect.id

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${local.service_name}-http-${var.environment}"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  target                = google_compute_target_http_proxy.redirect.id
  ip_address            = google_compute_global_address.default.id
  port_range            = "80"

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------

output "load_balancer_ip" {
  description = "Global IP address for the load balancer -- point DNS here"
  value       = google_compute_global_address.default.address
}
