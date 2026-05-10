from django.contrib import admin
from django.urls import include, path

from accounts.urls import admin_urlpatterns as user_admin_urls

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include(user_admin_urls)),
    path("api/", include("events.urls")),
    path("api/", include("leads.urls")),
    path("api/", include("emails.urls")),
    path("api/admin/", include("dashboards.urls")),
]
